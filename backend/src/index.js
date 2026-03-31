// backend/src/index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ============ MODELS ============

class AssessmentService {
  async createCandidate(data) {
    const { name, email, phone } = data;
    const result = await pool.query(
      'INSERT INTO candidates (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone]
    );
    return result.rows[0];
  }

  async createAssessment(data) {
    const { title, description, category, difficulty, duration_minutes, question_bank } = data;
    const result = await pool.query(
      `INSERT INTO assessments (title, description, category, difficulty, duration_minutes, question_bank) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description, category, difficulty, duration_minutes, JSON.stringify(question_bank)]
    );
    return result.rows[0];
  }

  async createSession(candidate_id, assessment_id, scheduled_at) {
    const result = await pool.query(
      `INSERT INTO assessment_sessions (candidate_id, assessment_id, status, scheduled_at) 
       VALUES ($1, $2, 'scheduled', $3) RETURNING *`,
      [candidate_id, assessment_id, scheduled_at]
    );
    return result.rows[0];
  }

  async updateSession(session_id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE assessment_sessions SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, session_id]
    );
    return result.rows[0];
  }

  async getSession(session_id) {
    const result = await pool.query(
      `SELECT s.*, a.question_bank, a.duration_minutes, a.category, c.name, c.phone
       FROM assessment_sessions s
       JOIN assessments a ON s.assessment_id = a.id
       JOIN candidates c ON s.candidate_id = c.id
       WHERE s.id = $1`,
      [session_id]
    );
    return result.rows[0];
  }

  async saveResponse(session_id, question_id, question_text, response_text, response_duration) {
    const result = await pool.query(
      `INSERT INTO responses (session_id, question_id, question_text, response_text, response_duration, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [session_id, question_id, question_text, response_text, response_duration]
    );
    return result.rows[0];
  }

  async getResponses(session_id) {
    const result = await pool.query(
      'SELECT * FROM responses WHERE session_id = $1 ORDER BY timestamp',
      [session_id]
    );
    return result.rows;
  }

  async saveScores(session_id, scores) {
    const result = await pool.query(
      `INSERT INTO scores 
       (session_id, overall_score, accuracy_score, clarity_score, depth_score, confidence_score, detailed_feedback)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        session_id,
        scores.overall_score,
        scores.criteria_scores.accuracy * 10,
        scores.criteria_scores.clarity * 10,
        scores.criteria_scores.depth * 10,
        scores.criteria_scores.confidence * 10,
        JSON.stringify(scores)
      ]
    );
    return result.rows[0];
  }

  async getScores(session_id) {
    const result = await pool.query(
      'SELECT * FROM scores WHERE session_id = $1',
      [session_id]
    );
    return result.rows[0];
  }
}

const service = new AssessmentService();

// ============ BOLNA INTEGRATION ============

async function startBolnaCall(sessionId) {
  const session = await service.getSession(sessionId);

  // Simple payload matching what works on the Bolna platform manually:
  // only agent_id + recipient_phone. The agent's own config (prompt, questions)
  // is managed inside the Bolna dashboard, not overridden here.
  const bolnaPayload = {
    agent_id: process.env.BOLNA_AGENT_ID,
    recipient_phone_number: session.phone,
  };

  console.log('Sending Bolna payload:', JSON.stringify(bolnaPayload, null, 2));

  const response = await fetch('https://api.bolna.dev/call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.BOLNA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bolnaPayload)
  });

  const data = await response.json();
  console.log('Bolna response:', JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(`Bolna API error (${response.status}): ${JSON.stringify(data)}`);
  }

  await service.updateSession(sessionId, {
    bolna_call_id: data.call_id,
    status: 'in_progress',
    started_at: new Date()
  });

  return data;
}


// ============ GROQ AI SCORING (FREE) ============

async function scoreWithGroq(sessionId) {
  const responses = await service.getResponses(sessionId);
  const session = await service.getSession(sessionId);

  const scoringPrompt = `You are an expert interviewer evaluating a candidate's assessment responses.

ASSESSMENT: ${session.category}
NUMBER OF QUESTIONS: ${responses.length}

Evaluate each response on these criteria (score 1-10):
1. ACCURACY: Technical correctness and factual accuracy
2. CLARITY: Clear communication and explanation ability
3. DEPTH: Level of detail and depth of understanding
4. CONFIDENCE: Conviction and knowledge demonstration

RESPONSES TO EVALUATE:
${responses.map((r, i) => `
QUESTION ${i + 1}: ${r.question_text}
ANSWER ${i + 1}: ${r.response_text}
DURATION: ${r.response_duration} seconds
`).join('\n---\n')}

You must respond with ONLY valid JSON in this exact format:
{
  "overall_score": 75,
  "criteria_scores": {
    "accuracy": 8,
    "clarity": 7,
    "depth": 7,
    "confidence": 8
  },
  "question_scores": [
    {
      "question_number": 1,
      "score": 8,
      "feedback": "Strong understanding of the concept with clear explanation."
    }
  ],
  "summary": "Overall performance summary in 2-3 sentences",
  "strengths": ["Point 1", "Point 2"],
  "improvements": ["Point 1", "Point 2"]
}`;

  // Use Groq API (FREE)
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{
        role: 'user',
        content: scoringPrompt
      }],
      temperature: 0.2,
      max_tokens: 4000
    })
  });

  const data = await response.json();
  const scoreText = data.choices[0].message.content;
  
  // Remove markdown code blocks if present
  const cleanedText = scoreText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const scores = JSON.parse(cleanedText);

  await service.saveScores(sessionId, scores);
  return scores;
}

// ============ API ROUTES ============

// Candidates
app.post('/api/candidates', async (req, res) => {
  try {
    console.log('Creating candidate with data:', req.body);
    const candidate = await service.createCandidate(req.body);
    console.log('Candidate created successfully:', candidate);
    res.json(candidate);
  } catch (error) {
    console.error('ERROR creating candidate:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/candidates/by-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query param required' });
    const result = await pool.query('SELECT * FROM candidates WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/candidates/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM candidates WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assessments
app.post('/api/assessments', async (req, res) => {
  try {
    const assessment = await service.createAssessment(req.body);
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/assessments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assessments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sessions
app.post('/api/sessions', async (req, res) => {
  try {
    const { candidate_id, assessment_id, scheduled_at } = req.body;
    const session = await service.createSession(candidate_id, assessment_id, scheduled_at);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/start', async (req, res) => {
  try {
    const callData = await startBolnaCall(req.params.id);
    res.json({ 
      status: 'initiated',
      call_id: callData.call_id,
      message: 'Assessment call started'
    });
  } catch (error) {
    console.error('Bolna call error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/status', async (req, res) => {
  try {
    const session = await service.getSession(req.params.id);
    res.json({ 
      status: session.status,
      started_at: session.started_at,
      completed_at: session.completed_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/results', async (req, res) => {
  try {
    const session = await service.getSession(req.params.id);
    const scores = await service.getScores(req.params.id);
    const responses = await service.getResponses(req.params.id);
    
    res.json({
      session,
      scores,
      responses,
      transcript: session.transcript
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WEBHOOKS ============

app.post('/api/webhooks/bolna', async (req, res) => {
  try {
    const { event, call_id, data } = req.body;

    // Find session by call_id
    const sessionResult = await pool.query(
      'SELECT id FROM assessment_sessions WHERE bolna_call_id = $1',
      [call_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionId = sessionResult.rows[0].id;

    switch (event) {
      case 'call_started':
        await service.updateSession(sessionId, {
          status: 'in_progress',
          started_at: new Date()
        });
        break;

      case 'transcript_updated':
        // Save individual responses during the call
        if (data.transcript) {
          await service.updateSession(sessionId, {
            transcript: data.transcript
          });
        }
        break;

      case 'call_ended':
        await service.updateSession(sessionId, {
          status: 'completed',
          completed_at: new Date(),
          transcript: data.transcript,
          recording_url: data.recording_url
        });

        // Parse transcript and save individual responses
        await parseAndSaveResponses(sessionId, data.transcript);

        // Trigger scoring
        setTimeout(async () => {
          try {
            await scoreWithGroq(sessionId);
          } catch (error) {
            console.error('Scoring error:', error);
          }
        }, 2000);
        break;
    }

    res.json({ status: 'webhook_processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to parse transcript
async function parseAndSaveResponses(sessionId, transcript) {
  const session = await service.getSession(sessionId);
  const questions = session.question_bank;

  // Simple parsing - in production, use more sophisticated NLP
  const lines = transcript.split('\n');
  let currentQuestion = null;
  let currentResponse = '';
  let questionIndex = 0;

  for (const line of lines) {
    if (line.includes('AI:') || line.includes('Interviewer:')) {
      // Check if this is a question
      for (let i = 0; i < questions.length; i++) {
        if (line.toLowerCase().includes(questions[i].question.toLowerCase().substring(0, 30))) {
          if (currentQuestion && currentResponse) {
            await service.saveResponse(
              sessionId,
              currentQuestion.id,
              currentQuestion.question,
              currentResponse.trim(),
              60 // Default duration
            );
          }
          currentQuestion = questions[i];
          currentResponse = '';
          questionIndex = i;
          break;
        }
      }
    } else if (line.includes('Candidate:') || line.includes('User:')) {
      currentResponse += line.replace(/^(Candidate|User):/, '').trim() + ' ';
    }
  }

  // Save last response
  if (currentQuestion && currentResponse) {
    await service.saveResponse(
      sessionId,
      currentQuestion.id,
      currentQuestion.question,
      currentResponse.trim(),
      60
    );
  }
}

// ============ START SERVER ============

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;