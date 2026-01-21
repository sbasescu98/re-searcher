const { useState, useEffect, useMemo } = React;

// --- Supabase Setup ---
const supabaseUrl = 'https://aupkxxtygoejkxzdunmq.supabase.co'; 
const supabaseKey = 'sb_publishable_nUHh6kOCuxYssJpBFyandg_6BKMV_84'; 
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);

const Icon = ({ name, className = "" }) => {
  useEffect(() => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (e) { }
    }
  }, [name]);
  return <i data-lucide={name} className={className}></i>;
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now - past;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  if (diffInDays < 1) return 'Today';
  if (diffInDays === 1) return '1 day ago';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return past.toLocaleDateString('en-GB');
};

const UNIVERSITY_DEPARTMENTS = [
  "Architecture", "Biology", "Business & Management", "Chemistry", 
  "Computer Science", "Economics", "Education", "Engineering", 
  "English & Literature", "Geography", "History", "Law", 
  "Linguistics", "Mathematics", "Medicine", "Neuroscience", 
  "Philosophy", "Physics", "Politics & Intl Relations", "Psychiatry", 
  "Psychology", "Sociology", "Veterinary Medicine", "Other"
];

function JobPlatform() {
  const [view, setView] = useState('student');
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null); 
  const [viewingStudy, setViewingStudy] = useState(null); 
  const [showPostForm, setShowPostForm] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  
  const [expandedStudy, setExpandedStudy] = useState(null);
  const [expandedAppId, setExpandedAppId] = useState(null);

  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '' });

  const initialJobForm = { businessName: '', jobTitle: '', description: '', category: 'Other', department: '', estimatedHours: '', location: '', payAmount: '', ethicsNumber: '' };
  const [jobForm, setJobForm] = useState(initialJobForm);
  const [appForm, setAppForm] = useState({ studentName: '', studentEmail: '', coverLetter: '' });

  useEffect(() => { 
    sb.auth.getSession().then(({ data: { session } }) => {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        if (sessionUser) setView('business'); 
        loadJobs();
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (event === 'SIGNED_IN') {
          loadJobs();
          setView('business');
      }
      if (event === 'SIGNED_OUT') {
          setApplications([]);
          setView('student');
          setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (view === 'admin' && user) loadApplications();
  }, [view, user]);

  const loadJobs = async () => {
    setLoading(true);
    const { data, error } = await sb.from('jobs').select('*, applications(*)');
    if (!error) setJobs(data || []);
    setLoading(false);
  };

  const loadApplications = async () => {
    setLoading(true);
    const { data, error } = await sb.from('applications').select(`*, jobs!inner ( id, job_title, business_name, contact_email, category )`).eq('jobs.contact_email', user.email);
    if (!error) setApplications(data || []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await sb.auth.signOut();
    localStorage.clear();
    window.location.reload();
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (authMode === 'signup' && authForm.password !== authForm.confirmPassword) return alert("Passwords do not match.");
    // CORRECTED: cam.ac.uk
    if (authMode === 'signup' && !authForm.email.toLowerCase().endsWith('cam.ac.uk')) {
      alert("Account creation is restricted to @cam.ac.uk emails.");
      return;
    }
    setLoading(true);
    let result = authMode === 'login' ? await sb.auth.signInWithPassword(authForm) : await sb.auth.signUp(authForm);
    if (result.error) {
        alert(result.error.message);
        setLoading(false);
    } else {
        window.location.reload();
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!appForm.studentEmail.toLowerCase().endsWith('cam.ac.uk')) {
      alert("Access restricted. Please use your @cam.ac.uk email address to submit interest.");
      return;
    }

    setLoading(true);
    const targetJob = selectedJob || viewingStudy;
    const { error } = await sb.from('applications').insert([{
      job_id: targetJob.id,
      student_name: appForm.studentName,
      student_email: appForm.studentEmail,
      cover_letter: appForm.coverLetter
    }]);
    
    if (error) alert(error.message);
    else { 
      alert("Application submitted. Someone from the research team will review it and get back to you."); 
      setSelectedJob(null); 
      setViewingStudy(null); 
      setAppForm({ studentName: '', studentEmail: '', coverLetter: '' }); 
    }
    setLoading(false);
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    const { error } = await sb.from('jobs').insert([{
      job_title: jobForm.jobTitle,
      business_name: jobForm.businessName,
      description: jobForm.description,
      category: 'Active', 
      location: jobForm.location,
      estimated_hours: jobForm.estimatedHours,
      contact_email: user.email, 
      pay_amount: jobForm.payAmount,
      pay_status: jobForm.department,
      ethics_number: jobForm.ethicsNumber,
      timestamp: new Date().toISOString()
    }]);
    if (error) alert(error.message);
    else { 
      setShowPostForm(false); setJobForm(initialJobForm); loadJobs(); setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 4000);
    }
  };

  const handleArchive = async (e, jobId) => {
    e.stopPropagation();
    if(!confirm("Archive this study? It will be removed from the volunteer page.")) return;
    const { error } = await sb.from('jobs').update({ category: 'Archived' }).eq('id', jobId);
    if (error) alert(error.message);
    else {
        loadJobs();
        loadApplications();
    }
  };

  const dashboardData = useMemo(() => {
    if (!user) return { active: [], archived: [] };
    const researcherStudies = jobs.filter(j => j.contact_email === user.email);
    const mapped = researcherStudies.map(study => ({
        ...study,
        apps: applications.filter(app => app.job_id === study.id)
    })).sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at));

    return {
        active: mapped.filter(s => s.category !== 'Archived'),
        archived: mapped.filter(s => s.category === 'Archived')
    };
  }, [jobs, applications, user]);

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (view === 'student') list = list.filter(j => j.category !== 'Archived');
    if (activeFilter !== 'All') list = list.filter(j => j.pay_status === activeFilter);
    return list.sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at));
  }, [jobs, activeFilter, view]);

  const StudyAccordion = ({ study, isArchived }) => (
    <div className={`bg-white rounded-[2rem] border shadow-md overflow-hidden ${isArchived ? 'border-slate-100 opacity-80' : 'border-slate-200'}`}>
      <div className="flex items-stretch">
        <button 
            onClick={() => setExpandedStudy(expandedStudy === study.id ? null : study.id)} 
            className={`flex-grow p-6 flex justify-between items-center text-left hover:bg-slate-100/50 transition-colors ${isArchived ? 'bg-slate-50/50' : 'bg-slate-50'}`}
        >
            <div>
              <div className="flex items-center gap-3 mb-1">
                  <h3 className={`text-lg font-black leading-none ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>{study.job_title}</h3>
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isArchived ? 'text-slate-400' : 'text-indigo-500'}`}>{study.apps.length} Total Applicants</p>
            </div>
            <Icon name={expandedStudy === study.id ? "chevron-up" : "chevron-down"} className="text-slate-400" />
        </button>
        {!isArchived && (
            <button 
                onClick={(e) => handleArchive(e, study.id)}
                className="px-6 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 border-l border-slate-200 transition-all group"
                title="Archive listing"
            >
                <Icon name="archive" className="w-5 h-5 group-hover:scale-110" />
            </button>
        )}
      </div>
      {expandedStudy === study.id && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          {study.apps.length > 0 ? (
            <React.Fragment>
                <div className="grid grid-cols-3 px-6 py-3 bg-slate-100/80 border-y border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Volunteer Name</span>
                    <span className="text-center">Date Applied</span>
                    <span className="text-right">Motivation</span>
                </div>
                <div className="divide-y divide-slate-100">
                    {study.apps.map(app => (
                    <div key={app.id} className="group">
                        <div onClick={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)} className="p-6 cursor-pointer grid grid-cols-3 items-center hover:bg-indigo-50/30 transition-all">
                        <div>
                            <p className="text-sm font-bold text-slate-900">{app.student_name}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{app.student_email}</p>
                        </div>
                        <div className="text-[11px] font-bold text-slate-600 text-center">{new Date(app.created_at).toLocaleDateString('en-GB')}</div>
                        <div className="text-right"><span className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 px-3 py-1 rounded-full group-hover:bg-indigo-100">{expandedAppId === app.id ? "Close" : "View Response"}</span></div>
                        </div>
                        {expandedAppId === app.id && (
                        <div className="px-6 pb-6 pt-0 animate-in fade-in duration-300">
                            <div className="bg-slate-100 rounded-2xl p-5 border border-slate-200">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Full Response</p>
                            <p className="text-sm text-slate-700 font-medium leading-relaxed italic whitespace-pre-wrap">{app.cover_letter || "No response provided."}</p>
                            </div>
                        </div>
                        )}
                    </div>
                    ))}
                </div>
            </React.Fragment>
          ) : (
            <div className="p-12 text-center bg-slate-50/30 text-slate-400 text-[10px] font-black uppercase tracking-widest">No applicants yet</div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div key={view} className="min-h-screen bg-slate-200/80 font-sans text-slate-900 pb-20">
      <nav className="bg-white border-b border-slate-300 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-md"><Icon name="search" className="w-6 h-6" /></div>
            <div className="text-left font-bold">
              <h1 className="text-xl tracking-tight text-slate-900 leading-none">(Re)Searcher</h1>
              <span className="text-[10px] text-indigo-500 uppercase tracking-widest">Cambridge Network</span>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mt-4 sm:mt-0">
            <button onClick={() => setView('student')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'student' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-indigo-400'}`}>Participants</button>
            <button onClick={() => setView('business')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'business' || view === 'admin' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-indigo-400'}`}>Researchers</button>
          </div>
        </div>
      </nav>

      {postSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4">
          <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-emerald-500">
            <Icon name="check-circle" className="w-5 h-5" /> Study Successfully Launched!
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-12 text-left">
        {view === 'student' ? (
          <div className="animate-in fade-in duration-500">
            <div className="max-w-3xl mb-12">
              <h2 className="text-5xl font-extrabold text-slate-900 mb-6 leading-[1.1]">Advance research, <br/><span className="text-indigo-600">get rewarded.</span></h2>
              <p className="text-lg text-slate-700 leading-relaxed font-medium mb-8">Browse active research studies across the university network. Contribute to world-class discoveries and earn incentives for your participation.</p>
              <div className="overflow-x-auto pb-4 custom-scrollbar mt-4">
                <div className="flex gap-2 min-w-max">
                  <button onClick={() => setActiveFilter('All')} className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${activeFilter === 'All' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>All Departments</button>
                  {UNIVERSITY_DEPARTMENTS.map(d => <button key={d} onClick={() => setActiveFilter(d)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${activeFilter === d ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>{d}</button>)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredJobs.map(job => (
                <div key={job.id} onClick={() => setViewingStudy(job)} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl hover:border-indigo-400 transition-all group flex flex-col h-full cursor-pointer relative">
                  
                  <div className="absolute top-8 right-8 text-[9px] font-black text-slate-400 uppercase">
                    {formatTimeAgo(job.timestamp || job.created_at)}
                  </div>

                  <h3 className="text-2xl font-bold mb-1 group-hover:text-indigo-600 transition-colors line-clamp-1 pr-16">{job.job_title}</h3>
                  <div className="flex items-center gap-2 text-black font-bold uppercase text-[11px] tracking-tight truncate mb-4">
                    <Icon name="microscope" className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                    <span>{job.business_name}</span><span className="text-slate-400 text-lg leading-none">•</span><span>{job.pay_status}</span>
                  </div>
                  <div className="h-20 overflow-hidden mb-6"><p className="text-slate-600 text-sm font-medium line-clamp-3 leading-relaxed">{job.description}</p></div>
                  <div className="flex gap-3 mb-8">
                    <div className="flex-1 bg-slate-100 p-3 rounded-2xl border border-slate-200"><div className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><Icon name="map-pin" className="w-3 h-3 text-indigo-500"/> Location</div><div className="text-[11px] font-bold text-slate-800 truncate">{job.location}</div></div>
                    <div className="flex-1 bg-slate-100 p-3 rounded-2xl border border-slate-200"><div className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><Icon name="clock" className="w-3 h-3 text-indigo-500"/> Time</div><div className="text-[11px] font-bold text-slate-800">{job.estimated_hours}h</div></div>
                    <div className="w-24 bg-emerald-50 p-3 rounded-2xl border border-emerald-100"><div className="text-[10px] font-black text-emerald-400 uppercase mb-1 text-center">Incentive</div><div className="text-[11px] font-bold text-emerald-800 truncate text-center">{job.pay_amount}</div></div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }} className="mt-auto w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg">Apply</button>
                </div>
              ))}
            </div>
          </div>
        ) : view === 'business' ? (
          <div className="max-w-2xl mx-auto">
            {!user ? (
              <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-200 animate-in slide-in-from-bottom-4">
                <Icon name="lock" className="w-12 h-12 text-indigo-500 mx-auto mb-6" />
                <h2 className="text-3xl font-black text-center mb-8">Researcher Access</h2>
                <form onSubmit={handleAuth} className="space-y-4">
                  <input required type="email" placeholder="University Email" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
                  <input required type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                  {authMode === 'signup' && (
                    <input required type="password" placeholder="Confirm Password" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={authForm.confirmPassword} onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})} />
                  )}
                  <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl uppercase">{authMode === 'login' ? 'Login' : 'Create Account'}</button>
                </form>
                <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full mt-6 text-sm font-bold text-indigo-600">{authMode === 'login' ? "Need an account? Sign up" : "Already have an account? Login"}</button>
              </div>
            ) : (
              <div className="text-center py-20 bg-white/80 rounded-[3rem] border border-slate-300 shadow-xl space-y-6 relative">
                <div className="absolute top-8 right-8 flex items-center gap-4">
                    <p className="text-xs font-black uppercase text-slate-400">Logged in: <span className="text-indigo-600">{user.email}</span></p>
                    <button onClick={handleLogout} className="text-xs font-black uppercase text-red-500 flex items-center gap-1 hover:underline"><Icon name="log-out" className="w-3 h-3"/> Logout</button>
                </div>
                <Icon name="microscope" className="w-16 h-16 text-indigo-200 mx-auto" />
                <h2 className="text-3xl font-black text-slate-900">Researcher Portal</h2>
                <div className="flex flex-col sm:flex-row gap-4 justify-center px-10 sm:px-0">
                  <button onClick={() => setShowPostForm(true)} className="bg-indigo-600 text-white px-8 py-5 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2"><Icon name="plus" className="w-5 h-5" /> New Study</button>
                  <button onClick={() => setView('admin')} className="bg-slate-900 text-white px-8 py-5 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2"><Icon name="users" className="w-5 h-5" /> View Applicants</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in duration-500 space-y-12">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setView('business')} className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline"><Icon name="arrow-left" className="w-4 h-4" /> Back to Portal</button>
                <p className="text-xs font-black uppercase text-slate-400">Logged In: <span className="text-indigo-600">{user?.email}</span></p>
            </div>

            <section className="space-y-6">
              <div className="flex items-center gap-4 px-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Recruitment</h2>
              </div>
              <div className="space-y-4">
                {dashboardData.active.map(study => <StudyAccordion key={study.id} study={study} isArchived={false} />)}
                {dashboardData.active.length === 0 && <div className="p-10 border-2 border-dashed border-slate-300 rounded-[2rem] text-center text-slate-400 font-bold text-xs uppercase">No active listings</div>}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4 px-2 opacity-60">
                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Archived Listings</h2>
              </div>
              <div className="space-y-4">
                {dashboardData.archived.map(study => <StudyAccordion key={study.id} study={study} isArchived={true} />)}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* --- MODALS (FIXED LAYOUT) --- */}

      {/* VIEW STUDY MODAL */}
      {viewingStudy && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-4" onClick={() => setViewingStudy(null)}>
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 text-left relative" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-8">
                <div className="pr-12">
                    <h3 className="text-3xl font-black text-slate-900 leading-tight mb-2">{viewingStudy.job_title}</h3>
                    <div className="flex items-center gap-2 text-black font-bold uppercase text-[11px] tracking-widest mb-4">
                        <Icon name="microscope" className="w-4 h-4 text-slate-500" />
                        <span>{viewingStudy.business_name}</span><span className="text-slate-400 text-lg">•</span><span>{viewingStudy.pay_status}</span>
                    </div>
                </div>
                <button onClick={() => setViewingStudy(null)} className="absolute top-8 right-8 bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><Icon name="x" className="w-6 h-6" /></button>
                </div>
                <div className="space-y-6 mb-10">
                <div><h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Study Description</h4><p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap text-sm">{viewingStudy.description}</p></div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Location</p><p className="font-bold text-slate-800 text-sm truncate flex items-center justify-center gap-1.5"><Icon name="map-pin" className="w-3.5 h-3.5 text-indigo-500"/>{viewingStudy.location}</p></div>
                    <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Time Req.</p><p className="font-bold text-slate-800 text-sm flex items-center justify-center gap-1.5"><Icon name="clock" className="w-3.5 h-3.5 text-indigo-500"/>{viewingStudy.estimated_hours}h</p></div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100"><p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Incentive</p><p className="font-bold text-emerald-800 text-sm text-center">{viewingStudy.pay_amount}</p></div>
                </div>
                </div>
                <button onClick={() => { setSelectedJob(viewingStudy); setViewingStudy(null); }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-colors">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* APPLY FORM MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-4">
            <form onSubmit={handleApply} className="bg-white rounded-[2.5rem] p-6 sm:p-10 max-w-xl w-full shadow-2xl text-left animate-in slide-in-from-bottom-4 relative border border-slate-200">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Express Interest</h3>
                    <button type="button" onClick={() => setSelectedJob(null)} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><Icon name="x" className="w-6 h-6" /></button>
                </div>
                <div className="space-y-6">
                <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase text-slate-500 ml-1">Full Name <span className="text-red-500">*</span></label>
                    <input required placeholder="Your full name" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-medium text-black outline-none focus:border-indigo-500" value={appForm.studentName} onChange={e => setAppForm({...appForm, studentName: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase text-slate-500 ml-1">University Email <span className="text-red-500">*</span></label>
                    <input required type="email" placeholder="crsid@cam.ac.uk" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-medium text-black outline-none focus:border-indigo-500" value={appForm.studentEmail} onChange={e => setAppForm({...appForm, studentEmail: e.target.value})} />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide ml-1">Must end in @cam.ac.uk</p>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase text-slate-500 ml-1">Motivation <span className="text-slate-400 font-bold">(Optional)</span></label>
                    <textarea placeholder="Tell us why you're a good fit or list relevant experience..." className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-medium text-black h-32 resize-none outline-none focus:border-indigo-500" value={appForm.coverLetter} onChange={e => setAppForm({...appForm, coverLetter: e.target.value})} />
                </div>
                <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl uppercase mt-4 hover:bg-indigo-700 transition-colors">
                    {loading ? 'Processing...' : 'Submit Interest'}
                </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW STUDY FORM MODAL (FIXED) */}
      {showPostForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <form onSubmit={handlePostJob} className="bg-white rounded-[2.5rem] p-6 sm:p-10 max-w-3xl w-full shadow-2xl text-left border border-slate-200 animate-in zoom-in-95 my-12">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Recruit Participants</h3>
                <button type="button" onClick={() => setShowPostForm(false)} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><Icon name="x" className="w-6 h-6" /></button>
                </div>
                <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5"><label className="text-xs font-black uppercase text-slate-500 ml-1">Lab/PI Name <span className="text-red-500">*</span></label><input required placeholder="e.g. Memory Group" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-medium outline-none focus:border-indigo-500" value={jobForm.businessName} onChange={e => setJobForm({...jobForm, businessName: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-xs font-black uppercase text-slate-500 ml-1">Department <span className="text-red-500">*</span></label><select required className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-medium outline-none focus:border-indigo-500 appearance-none" value={jobForm.department} onChange={e => setJobForm({...jobForm, department: e.target.value})}><option value="" disabled>Select</option>{UNIVERSITY_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                </div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase text-slate-500 ml-1">Study Title <span className="text-red-500">*</span></label><input required placeholder="e.g. Visual Recognition Test" className="w-full p-4 border border-slate-200 rounded-2xl font-medium text-black outline-none focus:border-indigo-500" value={jobForm.jobTitle} onChange={e => setJobForm({...jobForm, jobTitle: e.target.value})} /></div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase text-slate-500 ml-1">Study Description <span className="text-red-500">*</span></label><textarea required placeholder="Description, eligibility, protocol, etc..." className="w-full p-4 border border-slate-200 rounded-2xl h-32 outline-none focus:border-indigo-500" value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5"><label className="text-xs font-black uppercase text-slate-500 ml-1">Location <span className="text-red-500">*</span></label><input required placeholder="e.g. West Hub, Downing Site" className="w-full p-4 border border-slate-200 rounded-2xl font-medium outline-none focus:border-indigo-500" value={jobForm.location} onChange={e => setJobForm({...jobForm, location: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-xs font-black uppercase text-slate-500 ml-1">Time (Hrs) <span className="text-red-500">*</span></label><input required placeholder="1.5" className="w-full p-4 border border-slate-200 rounded-2xl font-medium outline-none focus:border-indigo-500" value={jobForm.estimatedHours} onChange={e => setJobForm({...jobForm, estimatedHours: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-xs font-black uppercase text-slate-500 ml-1">Incentive <span className="text-red-500">*</span></label><input required placeholder="e.g. £15/hr, £25 total" className="w-full p-4 border border-slate-200 rounded-2xl font-medium outline-none focus:border-indigo-500" value={jobForm.payAmount} onChange={e => setJobForm({...jobForm, payAmount: e.target.value})} /></div>
                </div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase text-slate-500 ml-1">Ethics Approval Code (Optional)</label><input placeholder="e.g. ES/N012345/1" className="w-full p-4 border border-slate-200 rounded-2xl font-medium outline-none focus:border-indigo-500" value={jobForm.ethicsNumber} onChange={e => setJobForm({...jobForm, ethicsNumber: e.target.value})} /></div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl mt-4 hover:bg-indigo-700 transition-colors uppercase tracking-tight">Launch Study</button>
                </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6366f1; }
      `}</style>
    </div>
  );
}

const domNode = document.getElementById('root');
const root = ReactDOM.createRoot(domNode);
root.render(<JobPlatform />);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = JobPlatform;
}