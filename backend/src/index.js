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

// ============ SSE CLIENT STORE ============
// Map<sessionId, Set<res>>
const sseClients = new Map();

function broadcastSessionUpdate(sessionId, data) {
  const clients = sseClients.get(String(sessionId));
  if (clients && clients.size > 0) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach(res => {
      try { res.write(message); } catch (_) {}
    });
  }
}

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
      `SELECT s.*, a.question_bank, a.duration_minutes, a.category, a.title as assessment_title,
              c.name, c.phone, c.email
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
    // Upsert so re-scoring doesn't create duplicates
    await pool.query('DELETE FROM scores WHERE session_id = $1', [session_id]);
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

// ============ HELPERS ============

function validatePhone(phone) {
  // Must start with + and have 7-15 digits
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

async function retryAsync(fn, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Attempt ${attempt} failed: ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
}

// ============ BOLNA INTEGRATION ============

async function startBolnaCall(sessionId) {
  const session = await service.getSession(sessionId);

  if (!validatePhone(session.phone)) {
    throw new Error(`Invalid phone number format: "${session.phone}". Must start with + and country code (e.g. +919876543210).`);
  }

  const questions = session.question_bank || [];
  const questionList = questions
    .map((q, i) => `Question ${i + 1}: ${q.question}`)
    .join('\n');

  // Dynamic agent prompt includes the actual assessment questions so the AI
  // conducts a structured interview specific to this assessment type.
  // Note: The exact field names for agent_prompts may vary by Bolna plan/version;
  // adjust agent_prompts keys if needed based on your Bolna dashboard config.
  const bolnaPayload = {
    agent_id: process.env.BOLNA_AGENT_ID,
    recipient_phone_number: session.phone,
    agent_prompts: {
      task_description: `You are an expert AI interviewer conducting a ${session.category} technical assessment for ${session.name}.

Your job is to ask the following questions in order, one at a time. After asking each question, wait for the candidate to finish their response before moving on. Be professional, encouraging, and concise.

QUESTIONS TO ASK:
${questionList}

After all questions are answered, thank the candidate by name and let them know the assessment is complete and their results will be available shortly. Then end the call.`,
    },
    // Metadata is echoed back in Bolna webhook events — used for session lookup
    metadata: {
      session_id: String(sessionId),
      assessment_category: session.category,
      candidate_name: session.name,
    },
  };

  console.log('Sending Bolna payload:', JSON.stringify(bolnaPayload, null, 2));

  const response = await retryAsync(async () => {
    const res = await fetch('https://api.bolna.dev/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BOLNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bolnaPayload)
    });
    const data = await res.json();
    console.log('Bolna response:', JSON.stringify(data, null, 2));
    if (!res.ok) {
      throw new Error(`Bolna API error (${res.status}): ${JSON.stringify(data)}`);
    }
    return data;
  });

  await service.updateSession(sessionId, {
    bolna_call_id: response.call_id,
    status: 'in_progress',
    started_at: new Date()
  });

  broadcastSessionUpdate(sessionId, {
    event: 'call_initiated',
    call_id: response.call_id,
    status: 'in_progress'
  });

  return response;
}

// ============ GROQ AI SCORING ============

async function scoreWithGroq(sessionId) {
  const responses = await service.getResponses(sessionId);
  const session = await service.getSession(sessionId);

  if (responses.length === 0) {
    console.warn(`No responses found for session ${sessionId} — skipping scoring.`);
    return null;
  }

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
ANSWER ${i + 1}: ${r.response_text || '(No response recorded)'}
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

  const groqResponse = await retryAsync(async () => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [{ role: 'user', content: scoringPrompt }],
        temperature: 0.2,
        max_tokens: 4000
      })
    });
    const data = await res.json();
    if (!res.ok || !data.choices?.[0]) {
      throw new Error(`Groq API error: ${JSON.stringify(data)}`);
    }
    return data;
  });

  const scoreText = groqResponse.choices[0].message.content;
  const cleanedText = scoreText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const scores = JSON.parse(cleanedText);

  await service.saveScores(sessionId, scores);

  broadcastSessionUpdate(sessionId, {
    event: 'scoring_complete',
    overall_score: scores.overall_score
  });

  return scores;
}

// ============ GROQ TRANSCRIPT PARSING ============

async function parseTranscriptWithGroq(sessionId, transcript) {
  const session = await service.getSession(sessionId);
  const questions = session.question_bank || [];

  if (!transcript || transcript.trim().length === 0) {
    console.warn(`Empty transcript for session ${sessionId} — skipping parse.`);
    return;
  }

  const questionList = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n');

  const parsePrompt = `You are parsing a phone interview transcript to extract the candidate's answers.

ASSESSMENT QUESTIONS (in order):
${questionList}

TRANSCRIPT:
${transcript}

Extract the candidate's response to each question above. The transcript may use speaker labels like "AI:", "Agent:", "Interviewer:", "Bot:", "Candidate:", "User:", or similar.

Return ONLY valid JSON in this format:
{
  "qa_pairs": [
    {
      "question_number": 1,
      "question_text": "exact question text",
      "response_text": "candidate's complete response in their own words",
      "estimated_duration": 45
    }
  ]
}

If a question was not asked or not answered, set response_text to "No response recorded" and estimated_duration to 0.`;

  try {
    const groqResponse = await retryAsync(async () => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [{ role: 'user', content: parsePrompt }],
          temperature: 0.1,
          max_tokens: 3000
        })
      });
      const data = await res.json();
      if (!res.ok || !data.choices?.[0]) {
        throw new Error(`Groq parse error: ${JSON.stringify(data)}`);
      }
      return data;
    });

    const rawText = groqResponse.choices[0].message.content;
    const cleanedText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    // Clear any previously saved responses for this session
    await pool.query('DELETE FROM responses WHERE session_id = $1', [sessionId]);

    for (const pair of parsed.qa_pairs) {
      const question = questions[pair.question_number - 1];
      if (!question) continue;
      await service.saveResponse(
        sessionId,
        question.id || pair.question_number,
        pair.question_text || question.question,
        pair.response_text,
        pair.estimated_duration || 60
      );
    }

    console.log(`Parsed ${parsed.qa_pairs.length} Q&A pairs for session ${sessionId}`);
  } catch (err) {
    console.error('Groq transcript parsing failed, falling back to regex:', err.message);
    await parseTranscriptFallback(sessionId, transcript);
  }
}

// Regex fallback if Groq parsing fails
async function parseTranscriptFallback(sessionId, transcript) {
  const session = await service.getSession(sessionId);
  const questions = session.question_bank || [];

  const lines = transcript.split('\n');
  let currentQuestion = null;
  let currentResponse = '';

  for (const line of lines) {
    if (line.match(/^(AI|Agent|Interviewer|Bot):/i)) {
      for (const q of questions) {
        if (line.toLowerCase().includes(q.question.toLowerCase().substring(0, 30))) {
          if (currentQuestion && currentResponse.trim()) {
            await service.saveResponse(sessionId, currentQuestion.id, currentQuestion.question, currentResponse.trim(), 60);
          }
          currentQuestion = q;
          currentResponse = '';
          break;
        }
      }
    } else if (line.match(/^(Candidate|User|Human):/i)) {
      currentResponse += line.replace(/^(Candidate|User|Human):/i, '').trim() + ' ';
    }
  }

  if (currentQuestion && currentResponse.trim()) {
    await service.saveResponse(sessionId, currentQuestion.id, currentQuestion.question, currentResponse.trim(), 60);
  }
}

// ============ API ROUTES ============

// Candidates
app.post('/api/candidates', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'name, email, and phone are required' });
    }
    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number. Use international format, e.g. +919876543210' });
    }
    const candidate = await service.createCandidate({ name, email, phone });
    res.json(candidate);
  } catch (error) {
    console.error('ERROR creating candidate:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A candidate with this email already exists' });
    }
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
    if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
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
    if (!candidate_id || !assessment_id) {
      return res.status(400).json({ error: 'candidate_id and assessment_id are required' });
    }
    const session = await service.createSession(candidate_id, assessment_id, scheduled_at || new Date());
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
    console.error('Bolna call error:', error.message);
    // Mark session as failed so UI can recover
    try {
      await service.updateSession(req.params.id, { status: 'failed' });
    } catch (_) {}
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/status', async (req, res) => {
  try {
    const session = await service.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({
      status: session.status,
      started_at: session.started_at,
      completed_at: session.completed_at,
      recording_url: session.recording_url
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/results', async (req, res) => {
  try {
    const session = await service.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const scores = await service.getScores(req.params.id);
    const responses = await service.getResponses(req.params.id);
    res.json({ session, scores, responses, transcript: session.transcript });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SSE: real-time session updates
app.get('/api/sessions/:id/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sessionId = String(req.params.id);
  if (!sseClients.has(sessionId)) sseClients.set(sessionId, new Set());
  sseClients.get(sessionId).add(res);

  // Send heartbeat every 20s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(sessionId)?.delete(res);
    if (sseClients.get(sessionId)?.size === 0) sseClients.delete(sessionId);
  });
});

// ============ ADMIN ROUTES ============

app.get('/api/admin/stats', async (req, res) => {
  try {
    const [totalCandidates, totalSessions, completedSessions, avgScoreRow] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM candidates'),
      pool.query('SELECT COUNT(*) FROM assessment_sessions'),
      pool.query("SELECT COUNT(*) FROM assessment_sessions WHERE status = 'completed'"),
      pool.query('SELECT ROUND(AVG(overall_score), 1) as avg FROM scores')
    ]);

    const total = parseInt(totalSessions.rows[0].count);
    const completed = parseInt(completedSessions.rows[0].count);

    res.json({
      total_candidates: parseInt(totalCandidates.rows[0].count),
      total_sessions: total,
      completed_sessions: completed,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      average_score: parseFloat(avgScoreRow.rows[0].avg) || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/sessions', async (req, res) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT s.id, s.status, s.started_at, s.completed_at, s.scheduled_at,
             c.name as candidate_name, c.email as candidate_email,
             a.title as assessment_title, a.category,
             sc.overall_score
      FROM assessment_sessions s
      JOIN candidates c ON s.candidate_id = c.id
      JOIN assessments a ON s.assessment_id = a.id
      LEFT JOIN scores sc ON s.id = sc.session_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.name ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
    }

    query += ` ORDER BY s.scheduled_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WEBHOOKS ============

app.post('/api/webhooks/bolna', async (req, res) => {
  try {
    const body = req.body;
    // Bolna may send event/call_id at top level or nested — handle both shapes
    const event = body.event || body.type;
    const call_id = body.call_id || body.data?.call_id;
    const data = body.data || body;
    const metadata = body.metadata || data.metadata || {};

    console.log('Bolna webhook received:', JSON.stringify({ event, call_id, metadata }, null, 2));

    // Find session: prefer metadata.session_id for reliability, fall back to call_id
    let sessionId = metadata.session_id;

    if (!sessionId && call_id) {
      const result = await pool.query(
        'SELECT id FROM assessment_sessions WHERE bolna_call_id = $1',
        [call_id]
      );
      sessionId = result.rows[0]?.id;
    }

    if (!sessionId) {
      console.warn('Webhook: session not found for call_id:', call_id, 'metadata:', metadata);
      return res.status(404).json({ error: 'Session not found' });
    }

    switch (event) {
      case 'call_started':
        await service.updateSession(sessionId, {
          status: 'in_progress',
          started_at: new Date()
        });
        broadcastSessionUpdate(sessionId, {
          event: 'call_started',
          status: 'in_progress',
          timestamp: new Date().toISOString()
        });
        break;

      case 'transcript_updated':
        if (data.transcript) {
          await service.updateSession(sessionId, { transcript: data.transcript });
          broadcastSessionUpdate(sessionId, {
            event: 'transcript_updated',
            preview: data.transcript.slice(-200) // last 200 chars for live preview
          });
        }
        break;

      case 'call_ended':
        await service.updateSession(sessionId, {
          status: 'completed',
          completed_at: new Date(),
          transcript: data.transcript || null,
          recording_url: data.recording_url || null
        });

        broadcastSessionUpdate(sessionId, {
          event: 'call_ended',
          status: 'completed',
          recording_url: data.recording_url || null
        });

        // Parse transcript using Groq AI, then score
        setImmediate(async () => {
          try {
            await parseTranscriptWithGroq(sessionId, data.transcript || '');
          } catch (err) {
            console.error('Transcript parse error:', err.message);
          }
          try {
            await scoreWithGroq(sessionId);
          } catch (err) {
            console.error('Scoring error:', err.message);
            broadcastSessionUpdate(sessionId, { event: 'scoring_failed', error: err.message });
          }
        });
        break;

      default:
        console.log(`Unhandled Bolna webhook event: ${event}`);
    }

    res.json({ status: 'webhook_processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
