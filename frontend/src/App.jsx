// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============ COMPONENTS ============

// Registration Page
function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('Submitting registration:', formData);
      const response = await fetch(`${API_BASE}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }
      
      const candidate = await response.json();
      console.log('Registration successful:', candidate);
      localStorage.setItem('candidateId', candidate.id);
      console.log('Redirecting to dashboard...');
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Voice AI Assessment</h1>
          <p className="text-gray-600">Register to start your assessment journey</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone (with country code)</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="+1234567890"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Register
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}

// Login Page
function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/candidates/by-email?email=${encodeURIComponent(email)}`);
      if (response.status === 404) {
        setError('No account found with that email. Please register first.');
        return;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }
      const candidate = await response.json();
      localStorage.setItem('candidateId', candidate.id);
      navigate('/dashboard');
    } catch (err) {
      if (!error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Login with your registered email</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-600 font-medium hover:underline">Register here</Link>
        </p>
      </div>
    </div>
  );
}

// Dashboard Page
function DashboardPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/assessments`);
      const data = await response.json();
      setAssessments(data);
    } catch (error) {
      console.error('Failed to fetch assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = async (assessmentId) => {
    const candidateId = localStorage.getItem('candidateId');
    if (!candidateId) {
      navigate('/register');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          assessment_id: assessmentId,
          scheduled_at: new Date().toISOString()
        })
      });
      const session = await response.json();
      navigate(`/assessment/${session.id}`);
    } catch (error) {
      alert('Failed to start assessment: ' + error.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl">Loading assessments...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Assessment Portal</h1>
          <Link to="/results" className="text-indigo-600 hover:text-indigo-800">View Results</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Available Assessments</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assessments.map(assessment => (
            <div key={assessment.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">{assessment.title}</h3>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                  {assessment.difficulty}
                </span>
              </div>
              
              <p className="text-gray-600 mb-4 line-clamp-2">{assessment.description}</p>
              
              <div className="flex items-center text-sm text-gray-500 mb-4 space-x-4">
                <span>⏱️ {assessment.duration_minutes} min</span>
                <span>📝 {assessment.question_bank?.length || 0} questions</span>
              </div>
              
              <button
                onClick={() => startAssessment(assessment.id)}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Start Assessment
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Assessment Page
function AssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('preparing');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession();
  }, [id]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${id}/status`);
      const data = await response.json();
      // Backend creates sessions with status 'scheduled'; map it to 'preparing' for the UI
      setStatus(data.status === 'scheduled' ? 'preparing' : data.status);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      setLoading(false);
    }
  };

  const startCall = async () => {
    setStatus('starting');
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${id}/start`, {
        method: 'POST'
      });
      const data = await response.json();
      setStatus('in_progress');
      
      // Poll for status
      const interval = setInterval(async () => {
        const statusResponse = await fetch(`${API_BASE}/api/sessions/${id}/status`);
        const statusData = await statusResponse.json();
        if (statusData.status === 'completed') {
          clearInterval(interval);
          navigate(`/results/${id}`);
        }
      }, 5000);
    } catch (error) {
      alert('Failed to start call: ' + error.message);
      setStatus('preparing');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl">
        {status === 'preparing' && (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Ready for Assessment?</h1>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Before you start:</h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                <li>Ensure you're in a quiet environment</li>
                <li>Have your phone ready to receive the call</li>
                <li>Speak clearly and take your time</li>
                <li>The assessment will take approximately 15 minutes</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Assessment Details</h3>
              <div className="space-y-2 text-gray-700">
                <p>📞 You will receive a phone call from our AI interviewer</p>
                <p>❓ Answer each question thoughtfully</p>
                <p>🎯 Be specific and provide examples when possible</p>
                <p>⏱️ No rush - quality over speed</p>
              </div>
            </div>

            <button
              onClick={startCall}
              className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors"
            >
              Start Assessment Call
            </button>
          </>
        )}

        {status === 'starting' && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Initiating Call...</h2>
            <p className="text-gray-600">Your phone will ring shortly</p>
          </div>
        )}

        {status === 'in_progress' && (
          <div className="text-center py-12">
            <div className="relative">
              <div className="animate-pulse rounded-full h-24 w-24 bg-green-200 mx-auto mb-6 flex items-center justify-center">
                <span className="text-4xl">📞</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment in Progress</h2>
            <p className="text-gray-600 mb-4">Answer each question thoughtfully</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              Do not close this window. You'll be automatically redirected when complete.
            </div>
          </div>
        )}

        {status === 'completed' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Complete!</h2>
            <p className="text-gray-600 mb-6">Your responses are being scored...</p>
            <button
              onClick={() => navigate(`/results/${id}`)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700"
            >
              View Results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Results Page
function ResultsPage() {
  const { id } = useParams();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
    // Poll for results if not ready
    const interval = setInterval(fetchResults, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${id}/results`);
      const data = await response.json();
      if (data.scores) {
        setResults(data);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    }
  };

  if (loading || !results?.scores) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Processing your results...</h2>
          <p className="text-gray-600 mt-2">This may take a minute</p>
        </div>
      </div>
    );
  }

  const scoreData = JSON.parse(results.scores.detailed_feedback);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8">
            <h1 className="text-3xl font-bold mb-2">Assessment Results</h1>
            <p className="text-indigo-100">Completed on {new Date(results.session.completed_at).toLocaleString()}</p>
          </div>

          {/* Overall Score */}
          <div className="p-8 border-b">
            <div className="text-center">
              <div className="inline-block">
                <div className="relative w-32 h-32">
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                    <circle 
                      cx="64" 
                      cy="64" 
                      r="56" 
                      stroke="#4f46e5" 
                      strokeWidth="8" 
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - scoreData.overall_score / 100)}`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-indigo-600">{scoreData.overall_score}</span>
                  </div>
                </div>
                <p className="mt-4 text-lg font-semibold text-gray-900">Overall Score</p>
              </div>
            </div>
          </div>

          {/* Criteria Scores */}
          <div className="p-8 border-b">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Performance Breakdown</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {Object.entries(scoreData.criteria_scores).map(([key, value]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-700 capitalize">{key}</span>
                    <span className="text-lg font-bold text-indigo-600">{value}/10</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${value * 10}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-8 border-b">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Summary</h2>
            <p className="text-gray-700 leading-relaxed">{scoreData.summary}</p>
          </div>

          {/* Strengths & Improvements */}
          <div className="p-8 grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-green-700 mb-4 flex items-center">
                <span className="mr-2">💪</span> Strengths
              </h3>
              <ul className="space-y-2">
                {scoreData.strengths.map((strength, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-orange-700 mb-4 flex items-center">
                <span className="mr-2">📈</span> Areas for Improvement
              </h3>
              <ul className="space-y-2">
                {scoreData.improvements.map((improvement, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-orange-500 mr-2">→</span>
                    <span className="text-gray-700">{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Question-by-Question */}
          <div className="p-8 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Detailed Feedback</h2>
            <div className="space-y-4">
              {scoreData.question_scores.map((q, i) => (
                <div key={i} className="bg-white rounded-lg p-4 border">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900">Question {q.question_number}</h4>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                      {q.score}/10
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">{q.feedback}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-8 bg-gray-100 flex justify-center space-x-4">
            <Link
              to="/dashboard"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
            >
              Take Another Assessment
            </Link>
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700"
            >
              Download Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/assessment/:id" element={<AssessmentPage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;