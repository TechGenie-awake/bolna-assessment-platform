// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============ TOAST NOTIFICATIONS ============

function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  return { toasts, addToast };
}

function ToastContainer({ toasts }) {
  const colors = { info: 'bg-blue-600', success: 'bg-green-600', error: 'bg-red-600' };
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={`${colors[t.type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ============ REGISTRATION PAGE ============

function RegisterPage() {
  const navigate = useNavigate();
  const { toasts, addToast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Registration failed');
      }
      const candidate = await response.json();
      localStorage.setItem('candidateId', candidate.id);
      navigate('/dashboard');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <ToastContainer toasts={toasts} />
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Voice AI Assessment</h1>
          <p className="text-gray-600">Register to start your assessment journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text" required value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email" required value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone (with country code)</label>
            <input
              type="tel" required value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="+919876543210"
            />
            <p className="text-xs text-gray-400 mt-1">International format required, e.g. +919876543210</p>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Registering...' : 'Register'}
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

// ============ LOGIN PAGE ============

function LoginPage() {
  const navigate = useNavigate();
  const { toasts, addToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/candidates/by-email?email=${encodeURIComponent(email)}`);
      if (response.status === 404) {
        addToast('No account found with that email. Please register first.', 'error');
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
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <ToastContainer toasts={toasts} />
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Login with your registered email</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="text-center mt-4 space-y-2">
          <p className="text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 font-medium hover:underline">Register here</Link>
          </p>
          <p className="text-sm text-gray-400">
            <Link to="/admin" className="hover:text-indigo-600">Admin Dashboard</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ DASHBOARD PAGE ============

function DashboardPage() {
  const navigate = useNavigate();
  const { toasts, addToast } = useToast();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/assessments`)
      .then(r => r.json())
      .then(data => setAssessments(data))
      .catch(() => addToast('Failed to load assessments', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const startAssessment = async (assessmentId) => {
    const candidateId = localStorage.getItem('candidateId');
    if (!candidateId) { navigate('/register'); return; }

    try {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId, assessment_id: assessmentId, scheduled_at: new Date().toISOString() })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create session');
      }
      const session = await response.json();
      navigate(`/assessment/${session.id}`);
    } catch (error) {
      addToast(error.message, 'error');
    }
  };

  const difficultyColor = (d) => ({
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-yellow-100 text-yellow-800',
    advanced: 'bg-red-100 text-red-800'
  }[d?.toLowerCase()] || 'bg-gray-100 text-gray-800');

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer toasts={toasts} />
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Assessment Portal</h1>
          <div className="flex items-center space-x-4">
            <Link to="/admin" className="text-sm text-gray-500 hover:text-indigo-600">Admin</Link>
            <button
              onClick={() => { localStorage.removeItem('candidateId'); navigate('/login'); }}
              className="text-sm text-gray-500 hover:text-red-600"
            >Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Available Assessments</h2>
        <p className="text-gray-500 mb-8">Select an assessment to begin your AI-conducted phone interview.</p>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-md p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded mb-4 w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded mb-2"></div>
                <div className="h-4 bg-gray-100 rounded mb-4 w-2/3"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-xl">No assessments available yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assessments.map(a => (
              <div key={a.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-semibold text-gray-900 flex-1 mr-2">{a.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${difficultyColor(a.difficulty)}`}>
                    {a.difficulty}
                  </span>
                </div>
                <p className="text-gray-600 mb-4 text-sm flex-1 line-clamp-2">{a.description}</p>
                <div className="flex items-center text-sm text-gray-500 mb-4 space-x-4">
                  <span>⏱ {a.duration_minutes} min</span>
                  <span>📝 {a.question_bank?.length || 0} questions</span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">{a.category}</span>
                </div>
                <button
                  onClick={() => startAssessment(a.id)}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Start Assessment
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ ASSESSMENT PAGE (with SSE real-time monitor) ============

function AssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, addToast } = useToast();
  const [status, setStatus] = useState('preparing');
  const [loading, setLoading] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [transcriptPreview, setTranscriptPreview] = useState('');
  const [showManualEnd, setShowManualEnd] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const timerRef = useRef(null);
  const sseRef = useRef(null);
  const pollRef = useRef(null);
  const manualBtnTimerRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/sessions/${id}/status`)
      .then(r => r.json())
      .then(data => {
        const uiStatus = data.status === 'scheduled' ? 'preparing' : data.status;
        setStatus(uiStatus);
        if (uiStatus === 'in_progress') startSSE();
        if (uiStatus === 'completed') navigate(`/results/${id}`);
      })
      .catch(() => addToast('Failed to load session', 'error'))
      .finally(() => setLoading(false));

    return () => cleanup();
  }, [id]);

  function startSSE() {
    if (sseRef.current) return;
    sseRef.current = new EventSource(`${API_BASE}/api/sessions/${id}/stream`);

    sseRef.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'call_started') {
          setStatus('in_progress');
          startTimer();
        }
        if (data.event === 'transcript_updated' && data.preview) {
          setTranscriptPreview(data.preview);
        }
        if (data.event === 'call_ended' || data.event === 'scoring_complete') {
          cleanup();
          navigate(`/results/${id}`);
        }
        if (data.event === 'scoring_failed') {
          addToast('Scoring encountered an issue. Redirecting to results...', 'error');
          setTimeout(() => navigate(`/results/${id}`), 2000);
        }
      } catch (_) {}
    };

    sseRef.current.onerror = () => {
      // SSE failed — fall back to polling
      sseRef.current?.close();
      sseRef.current = null;
      startPolling();
    };
  }

  function startTimer() {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setCallDuration(s => s + 1), 1000);
    // Show manual-end button after 30s in case webhook never arrives
    manualBtnTimerRef.current = setTimeout(() => setShowManualEnd(true), 30000);
  }

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/sessions/${id}/status`);
        const data = await r.json();
        if (data.status === 'completed') {
          cleanup();
          navigate(`/results/${id}`);
        }
      } catch (_) {}
    }, 5000);
  }

  function cleanup() {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    clearTimeout(manualBtnTimerRef.current);
    sseRef.current?.close();
    timerRef.current = null;
    pollRef.current = null;
    sseRef.current = null;
    manualBtnTimerRef.current = null;
  }

  const handleManualEnd = async () => {
    setManualLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${id}/complete`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process results');
      }
      cleanup();
      // Give scoring a moment to kick off, then go to results
      addToast('Processing your results...', 'info');
      setTimeout(() => navigate(`/results/${id}`), 2500);
    } catch (error) {
      addToast(error.message, 'error');
      setManualLoading(false);
    }
  };

  const startCall = async () => {
    setStatus('starting');
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${id}/start`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to initiate call');
      }
      setStatus('in_progress');
      startTimer();
      startSSE();
    } catch (error) {
      addToast(error.message, 'error');
      setStatus('preparing');
    }
  };

  const formatDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <ToastContainer toasts={toasts} />
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl">

        {status === 'preparing' && (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Ready for Assessment?</h1>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Before you start:</h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
                <li>Ensure you're in a quiet environment</li>
                <li>Have your phone ready to receive the call</li>
                <li>Speak clearly and take your time</li>
                <li>The assessment will take approximately 15 minutes</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 mb-6 space-y-2 text-gray-700 text-sm">
              <p>📞 You will receive a phone call from our AI interviewer</p>
              <p>❓ Answer each question thoughtfully</p>
              <p>🎯 Be specific and provide examples when possible</p>
              <p>⏱ No rush — quality over speed</p>
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
          <div className="text-center py-8">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="animate-ping absolute inset-0 rounded-full bg-green-300 opacity-75"></div>
              <div className="relative rounded-full h-24 w-24 bg-green-200 flex items-center justify-center">
                <span className="text-4xl">📞</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Assessment in Progress</h2>

            {/* Live call duration */}
            <div className="text-3xl font-mono font-bold text-indigo-600 my-3">
              {formatDuration(callDuration)}
            </div>

            {/* Live transcript preview */}
            {transcriptPreview && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left mt-4 mb-4">
                <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Live Transcript</p>
                <p className="text-sm text-gray-700 italic">"...{transcriptPreview}"</p>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              Do not close this window. You'll be automatically redirected when the call ends.
            </div>

            {showManualEnd && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-3">Call already finished but page didn't redirect?</p>
                <button
                  onClick={handleManualEnd}
                  disabled={manualLoading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {manualLoading ? 'Processing results...' : 'My call has ended — view results'}
                </button>
              </div>
            )}
          </div>
        )}

        {status === 'completed' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Complete!</h2>
            <p className="text-gray-600 mb-6">Your responses are being scored by AI...</p>
            <button
              onClick={() => navigate(`/results/${id}`)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700"
            >
              View Results
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Call Failed</h2>
            <p className="text-gray-600 mb-6">The call could not be initiated. Please check your phone number and try again.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ RESULTS PAGE ============

function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/sessions/${id}/results`);
        const data = await r.json();
        if (data.scores) {
          setResults(data);
          setLoading(false);
          clearInterval(pollRef.current);
        }
      } catch (_) {}
    };

    fetchResults();
    pollRef.current = setInterval(fetchResults, 3000);
    return () => clearInterval(pollRef.current);
  }, [id]);

  const handlePrint = () => window.print();

  const scoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const scoreBarColor = (score) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading || !results?.scores) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Processing your results...</h2>
          <p className="text-gray-500 mt-2 text-sm">AI is analysing your responses. This usually takes under a minute.</p>
        </div>
      </div>
    );
  }

  const scoreData = JSON.parse(results.scores.detailed_feedback);
  const completedAt = results.session.completed_at
    ? new Date(results.session.completed_at).toLocaleString()
    : 'N/A';

  return (
    <div className="min-h-screen bg-gray-50 py-8 print:bg-white print:py-0">
      <div className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden print:shadow-none print:rounded-none">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 print:bg-indigo-600">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold mb-1">Assessment Results</h1>
                <p className="text-indigo-200 text-sm">
                  {results.session.name} &bull; {results.session.assessment_title || results.session.category}
                </p>
                <p className="text-indigo-100 text-sm mt-1">Completed on {completedAt}</p>
              </div>
              <div className="print:hidden flex space-x-2">
                <button
                  onClick={handlePrint}
                  className="bg-white text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-50"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Overall Score */}
          <div className="p-8 border-b">
            <div className="flex items-center justify-center space-x-12">
              <div className="text-center">
                <div className="relative w-36 h-36">
                  <svg className="transform -rotate-90 w-36 h-36">
                    <circle cx="72" cy="72" r="60" stroke="#e5e7eb" strokeWidth="10" fill="none" />
                    <circle
                      cx="72" cy="72" r="60"
                      stroke={scoreData.overall_score >= 70 ? '#22c55e' : scoreData.overall_score >= 50 ? '#eab308' : '#ef4444'}
                      strokeWidth="10" fill="none"
                      strokeDasharray={`${2 * Math.PI * 60}`}
                      strokeDashoffset={`${2 * Math.PI * 60 * (1 - scoreData.overall_score / 100)}`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${scoreColor(scoreData.overall_score)}`}>{scoreData.overall_score}</span>
                    <span className="text-xs text-gray-400">/ 100</span>
                  </div>
                </div>
                <p className="mt-3 text-lg font-semibold text-gray-900">Overall Score</p>
              </div>

              <div className="space-y-2 text-sm">
                {[
                  ['Questions answered', results.responses?.length || 0],
                  ['Category', results.session.category],
                  ['Duration', results.session.duration_minutes ? `${results.session.duration_minutes} min` : '—'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between space-x-6">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-800">{val}</span>
                  </div>
                ))}
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
                    <span className={`text-lg font-bold ${scoreBarColor(value).replace('bg-', 'text-')}`}>{value}/10</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`${scoreBarColor(value)} h-2.5 rounded-full transition-all duration-1000`}
                      style={{ width: `${value * 10}%` }}
                    />
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
          <div className="p-8 grid md:grid-cols-2 gap-8 border-b">
            <div>
              <h3 className="text-lg font-bold text-green-700 mb-4">Strengths</h3>
              <ul className="space-y-2">
                {scoreData.strengths.map((s, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-green-500 mr-2 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-700 text-sm">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-orange-700 mb-4">Areas for Improvement</h3>
              <ul className="space-y-2">
                {scoreData.improvements.map((item, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-orange-500 mr-2 mt-0.5 flex-shrink-0">→</span>
                    <span className="text-gray-700 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Question-by-question feedback */}
          <div className="p-8 bg-gray-50 border-b">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Detailed Feedback</h2>
            <div className="space-y-4">
              {scoreData.question_scores.map((q, i) => {
                const response = results.responses?.[i];
                return (
                  <div key={i} className="bg-white rounded-lg p-5 border">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900">Question {q.question_number}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        q.score >= 8 ? 'bg-green-100 text-green-800' :
                        q.score >= 6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>{q.score}/10</span>
                    </div>
                    {response && (
                      <p className="text-xs text-gray-400 mb-2 italic">Q: {response.question_text}</p>
                    )}
                    <p className="text-gray-600 text-sm">{q.feedback}</p>
                    {response?.response_text && (
                      <details className="mt-3">
                        <summary className="text-xs text-indigo-600 cursor-pointer hover:underline">Show your answer</summary>
                        <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-3 italic">"{response.response_text}"</p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recording + Transcript */}
          {(results.session.recording_url || results.transcript) && (
            <div className="p-8 border-b">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Call Recording & Transcript</h2>

              {results.session.recording_url && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2 font-medium">Audio Recording</p>
                  <audio controls className="w-full rounded-lg" src={results.session.recording_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {results.transcript && (
                <div>
                  <button
                    onClick={() => setShowTranscript(v => !v)}
                    className="text-sm text-indigo-600 font-medium hover:underline"
                  >
                    {showTranscript ? 'Hide Transcript' : 'Show Full Transcript'}
                  </button>
                  {showTranscript && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
                      {results.transcript}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="p-8 bg-gray-100 print:hidden flex flex-wrap justify-center gap-4">
            <Link to="/dashboard" className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
              Take Another Assessment
            </Link>
            <button
              onClick={handlePrint}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800"
            >
              Download Report (PDF)
            </button>
            <Link to="/admin" className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-white">
              Admin Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN DASHBOARD ============

function AdminPage() {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [statsRes, sessionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`),
        fetch(`${API_BASE}/api/admin/sessions?status=${statusFilter}&search=${encodeURIComponent(search)}&limit=50`)
      ]);
      setStats(await statsRes.json());
      setSessions(await sessionsRes.json());
    } catch (e) {
      console.error('Admin fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [statusFilter, search]);

  const statusBadge = (s) => ({
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }[s] || 'bg-gray-100 text-gray-800');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Admin Dashboard</h1>
          <Link to="/dashboard" className="text-sm text-indigo-600 hover:underline">Candidate View</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Candidates', value: stats.total_candidates, icon: '👥' },
              { label: 'Total Sessions', value: stats.total_sessions, icon: '📋' },
              { label: 'Completion Rate', value: `${stats.completion_rate}%`, icon: '✅' },
              { label: 'Average Score', value: stats.average_score || '—', icon: '📊' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl shadow-sm p-6 border">
                <div className="text-3xl mb-2">{card.icon}</div>
                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                <div className="text-sm text-gray-500 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 flex-1 min-w-48"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={fetchData}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Refresh
          </button>
        </div>

        {/* Sessions Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900">Assessment Sessions ({sessions.length})</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No sessions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Assessment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sessions.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{s.candidate_name}</div>
                        <div className="text-gray-400 text-xs">{s.candidate_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-800">{s.assessment_title}</div>
                        <div className="text-gray-400 text-xs">{s.category}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(s.status)}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.overall_score != null ? (
                          <span className={`font-bold ${s.overall_score >= 70 ? 'text-green-600' : s.overall_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {s.overall_score}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(s.scheduled_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {s.status === 'completed' && (
                          <Link
                            to={`/results/${s.id}`}
                            className="text-indigo-600 hover:underline text-xs font-medium"
                          >
                            View Results
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
