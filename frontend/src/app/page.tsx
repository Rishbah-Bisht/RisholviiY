"use client";

import {
  BookOpen,
  Building2,
  FileUp,
  GraduationCap,
  Layers3,
  LogOut,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Settings,
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Menu,
  X,
  Activity,
  Database,
  Cloud,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, api, asset } from "@/lib/api";
import ApiUsagePanel from "./components/ApiUsagePanel";

const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const getIdStr = (obj: any): string => {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "object") {
    if (obj._id) return typeof obj._id === "string" ? obj._id : String(obj._id);
    if (obj.id) return typeof obj.id === "string" ? obj.id : String(obj.id);
  }
  return String(obj);
};

type User = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "user";
  adminScopes?: Scope[];
  institute?: string;
  course?: string;
  semester?: string;
};

type Scope = { institute: Ref | string; course: Ref | string };
type Ref = { _id: string; name: string; shortForm?: string; code?: string; number?: number };
type Institute = Ref & { logoUrl?: string };
type Course = Omit<Ref, "code"> & { institute: Ref };
type Semester = Ref & { course: Ref; number: number };
type Subject = Ref & { institute?: Ref; course?: Ref; semester: Ref; year?: number };
type PyqFilters = {
  institute: string;
  course: string;
  semester: string;
  subjectYear: string;
  subject: string;
  year: string;
};
type Pyq = {
  _id: string;
  title: string;
  year: number;
  examType: string;
  views?: number;
  fileUrl: string;
  institute: Ref;
  course: Ref;
  semester: Ref;
  subject: Ref & { year?: number };
  uploadedBy?: Ref & { email?: string };
};

type Toast = { type: "success" | "error"; text: string } | null;

const nav = [
  { id: "overview", label: "Overview", icon: ShieldCheck },
  { id: "institutes", label: "Institutes", icon: Building2, superOnly: true },
  { id: "courses", label: "Courses", icon: GraduationCap, superOnly: true },
  { id: "semesters", label: "Semesters", icon: Layers3, superOnly: true },
  { id: "subjects", label: "Subjects", icon: BookOpen, superOnly: true },
  { id: "pyqs", label: "PYQs", icon: FileUp },
  { id: "ai-assistant", label: "AI Assistant", icon: Sparkles, href: "/ai-assistant" },
  { id: "users", label: "Users", icon: Users, superOnly: true },
  { id: "api-usage", label: "API Usage", icon: Activity, superOnly: true },
];

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [active, setActive] = useState("overview");
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(false);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pyqs, setPyqs] = useState<Pyq[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<PyqFilters>({ institute: "", course: "", semester: "", subjectYear: "", subject: "", year: "" });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{ totalToday: number; dailyLimit: number; percentage: number } | null>(null);
  const [systemStats, setSystemStats] = useState<any | null>(null);
  const [userTokenStatus, setUserTokenStatus] = useState<{
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    zone: string;
    tokensBorrowedToday: number;
    sharedPool: number;
    isThrottled: boolean;
    cycleUsed?: number;
    cycleLimit?: number;
    cycleRemaining?: number;
    nextCycleReset?: string;
    cycleChatsCompleted?: number;
    modelUsage?: Array<{
      model: string;
      apiName: string;
      tokensUsed: number;
      requestsCount: number;
    }>;
  } | null>(null);
  const [borrowLoading, setBorrowLoading] = useState(false);

  const applyUser = useCallback((nextUser: User) => {
    setUser(nextUser);
    if (nextUser.role === "user") {
      const needsOnboard = !nextUser.institute || !nextUser.course || !nextUser.semester;
      setShowOnboarding(needsOnboard);
      setFilters((prev) => ({
        ...prev,
        institute: nextUser.institute || "",
        course: nextUser.course || "",
        semester: nextUser.semester || "",
      }));
    } else {
      setShowOnboarding(false);
    }
  }, []);

  const isSuper = user?.role === "super_admin";

  const notify = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2800);
  };

  const authed = useCallback(
    async <T,>(path: string, options = {}) => api<T>(path, { token, ...options }),
    [token]
  );

  const loadAll = useCallback(async () => {
    if (!token) return;
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    const [instituteData, courseData, semesterData, subjectData, pyqData] = await Promise.all([
      authed<{ institutes: Institute[] }>("/institutes"),
      authed<{ courses: Course[] }>("/courses"),
      authed<{ semesters: Semester[] }>("/semesters"),
      authed<{ subjects: Subject[] }>("/subjects"),
      authed<{ pyqs: Pyq[] }>(`/pyqs${query ? `?${query}` : ""}`),
    ]);
    setInstitutes(instituteData.institutes);
    setCourses(courseData.courses);
    setSemesters(semesterData.semesters);
    setSubjects(subjectData.subjects);
    setPyqs(pyqData.pyqs);
    if (isSuper) {
      try {
        const [userData, tokenData, statsData] = await Promise.all([
          authed<{ users: User[] }>("/users"),
          authed<{
            combinedSummary: {
              totalTokensUsed: number;
              totalLimit: number;
              percentage: number;
            };
          }>("/admin/token-usage"),
          authed<any>("/admin/system-stats"),
        ]);
        setUsers(userData.users);
        setTokenUsage({
          totalToday: tokenData.combinedSummary.totalTokensUsed,
          dailyLimit: tokenData.combinedSummary.totalLimit,
          percentage: tokenData.combinedSummary.percentage,
        });
        setSystemStats(statsData);
      } catch (err) {
        console.error("Failed to load Super Admin dashboard details:", err);
      }
    }
    if (user && user.role === "user") {
      try {
        const tokenStatus = await authed<{
          used: number;
          limit: number;
          remaining: number;
          percentage: number;
          zone: string;
          tokensBorrowedToday: number;
          sharedPool: number;
          isThrottled: boolean;
        }>("/users/token-status");
        setUserTokenStatus(tokenStatus);
      } catch (err) {
        console.error("Failed to load user token status:", err);
      }
    }
  }, [authed, filters, isSuper, token, user]);

  const handleBorrowCredits = async () => {
    if (!token || borrowLoading) return;
    setBorrowLoading(true);
    try {
      const data = await authed<{ message: string; tokensBorrowedToday: number; limit: number }>("/users/borrow", {
        method: "POST",
      });
      notify({ type: "success", text: data.message });
      const tokenStatus = await authed<typeof userTokenStatus>("/users/token-status");
      setUserTokenStatus(tokenStatus);
    } catch (err: any) {
      notify({ type: "error", text: err.message || "Failed to borrow credits" });
    } finally {
      setBorrowLoading(false);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      const savedToken = localStorage.getItem("pyq_token");
      if (!savedToken) {
        setBootstrapping(false);
        return;
      }
      setToken(savedToken);
      try {
        const data = await api<{ user: User }>("/auth/me", { token: savedToken });
        applyUser(data.user);
      } catch {
        localStorage.removeItem("pyq_token");
        setToken("");
      } finally {
        setBootstrapping(false);
      }
    }
    bootstrap();
  }, [applyUser]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (user?.role) {
        document.documentElement.setAttribute("data-role", user.role);
      } else {
        document.documentElement.removeAttribute("data-role");
      }
    }
    return () => {
      if (typeof window !== "undefined") {
        document.documentElement.removeAttribute("data-role");
      }
    };
  }, [user]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab) {
        setActive(tab);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAll().catch((error: Error) => notify({ type: "error", text: error.message }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  const displayedInstitutes = useMemo(() => {
    if (!user) return institutes;
    if (user.role === "super_admin") return institutes;
    if (user.role === "admin") {
      if (!user.adminScopes) return [];
      const allowedIds = user.adminScopes.map((scope: any) => getIdStr(scope.institute));
      return institutes.filter((inst) => allowedIds.includes(getIdStr(inst)));
    }
    if (!user.institute) return [];
    return institutes.filter((i) => getIdStr(i) === getIdStr(user.institute));
  }, [user, institutes]);

  const displayedCourses = useMemo(() => {
    if (!user) return courses;
    if (user.role === "super_admin") return courses;
    if (user.role === "admin") {
      if (!user.adminScopes) return [];
      const allowedIds = user.adminScopes.map((scope: any) => getIdStr(scope.course));
      return courses.filter((c) => allowedIds.includes(getIdStr(c)));
    }
    if (!user.course) return [];
    return courses.filter((c) => getIdStr(c) === getIdStr(user.course));
  }, [user, courses]);

  const displayedSemesters = useMemo(() => {
    if (!user) return semesters;
    if (user.role === "super_admin") return semesters;
    if (user.role === "admin") {
      if (!user.adminScopes) return [];
      const allowedCourseIds = user.adminScopes.map((scope: any) => getIdStr(scope.course));
      return semesters.filter((s) => allowedCourseIds.includes(getIdStr(s.course)));
    }
    if (!user.semester) return [];
    return semesters.filter((s) => getIdStr(s) === getIdStr(user.semester));
  }, [user, semesters]);

  const displayedSubjects = useMemo(() => {
    if (!user) return subjects;
    if (user.role === "super_admin") return subjects;
    if (user.role === "admin") {
      if (!user.adminScopes) return [];
      const allowedCourseIds = user.adminScopes.map((scope: any) => getIdStr(scope.course));
      return subjects.filter((s) => allowedCourseIds.includes(getIdStr(s.course)));
    }
    if (!user.semester) return [];
    return subjects.filter((s) => getIdStr(s.semester) === getIdStr(user.semester));
  }, [user, subjects]);

  const stats = useMemo(
    () => [
      ["Institutes", displayedInstitutes.length],
      ["Courses", displayedCourses.length],
      ["Subjects", displayedSubjects.length],
      ["PYQs", pyqs.length],
    ],
    [displayedCourses.length, displayedInstitutes.length, pyqs.length, displayedSubjects.length]
  );

  if (bootstrapping) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-tr from-[#7a2854]/10 via-[#f3f4f6] to-[#eca27c]/10">
        <div className="relative flex flex-col items-center">
          <div className="absolute -inset-4 rounded-full bg-[var(--brand)]/10 blur-xl animate-pulse" />
          <div className="relative h-16 w-16 rounded-2xl bg-white border border-white/40 shadow-xl flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-[var(--brand)] animate-pulse" />
          </div>
          <p className="mt-6 text-sm font-bold tracking-widest text-[var(--brand-accent)] uppercase animate-pulse">
            Loading RisholviiY...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen setToken={setToken} notify={notify} toast={toast} />;
  }

  const isMandatoryOnboarding = user.role === "user" && (!user.institute || !user.course || !user.semester);

  if (showOnboarding) {
    return (
      <OnboardingScreen
        user={user}
        setUser={applyUser}
        institutes={institutes}
        courses={courses}
        semesters={semesters}
        token={token}
        loadAll={loadAll}
        isMandatory={isMandatoryOnboarding}
        onCancel={() => setShowOnboarding(false)}
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  const visibleNav = nav.filter((item) => !item.superOnly || isSuper);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Mobile Top Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-white px-4 py-3 lg:hidden shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition active:scale-95 cursor-pointer shrink-0"
            title="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[var(--brand)] truncate">RisholviiY</span>
              <span className="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--brand)] capitalize shrink-0">
                {user.role.replace("_", " ")}
              </span>
            </div>
            <span className="text-[9px] text-[var(--muted)] font-semibold leading-none">
              Design & Developed by Rishabh Bisht
            </span>
          </div>
        </div>
      </div>

      {/* Sliding Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sliding Mobile Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transition-transform duration-300 transform lg:hidden flex flex-col ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">

            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-lg font-bold text-[var(--brand)] truncate">RisholviiY</p>
              <p className="text-xs text-[#707070] capitalize truncate">{user.role.replace("_", " ")}</p>
              {user.role === "admin" && user.adminScopes && user.adminScopes.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 max-w-[180px]">
                  {user.adminScopes.map((scope, idx) => {
                    const inst = scope.institute;
                    const course = scope.course;
                    const instName = typeof inst === "string" ? inst : inst?.shortForm || inst?.name || "Unknown";
                    const courseName = typeof course === "string" ? course : course?.name || "Unknown";
                    return (
                      <span key={idx} className="text-[10px] text-[var(--muted)] font-medium truncate" title={`${instName} - ${courseName}`}>
                        • {instName} ({courseName})
                      </span>
                    );
                  })}
                </div>
              )}
              <span className="text-[9px] text-[var(--muted)] font-semibold leading-none mt-0.5 whitespace-nowrap">
                Design & Developed by Rishabh Bisht
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition shrink-0"
            title="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            const className = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition w-full ${selected
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--muted)] hover:bg-[#f7eef3] hover:text-[var(--brand)]"
              }`;

            const handleClick = () => {
              if (!("href" in item && item.href)) {
                setActive(item.id);
              }
              setMobileMenuOpen(false);
            };

            if ("href" in item && item.href) {
              return (
                <Link key={item.id} href={item.href} className={className} onClick={handleClick}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            }
            return (
              <button key={item.id} onClick={handleClick} className={className}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          {user.role === "user" && (
            <button
              onClick={() => {
                setShowOnboarding(true);
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-3 py-2 text-sm font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/10 transition"
            >
              <Settings size={16} />
              Preferences
            </button>
          )}
          <button
            onClick={() => {
              localStorage.removeItem("pyq_token");
              setToken("");
              setUser(null);
              setMobileMenuOpen(false);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--brand)]"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Desktop Static Sidebar */}
        <aside className="hidden lg:flex lg:flex-col border-r border-[var(--line)] bg-white sticky top-0 h-screen w-72 shrink-0">
          <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100">
            <div className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center bg-[var(--brand)]/5 shrink-0">
              <Sparkles className="h-6 w-6 text-[var(--brand)]" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-xl font-bold text-[var(--brand)] truncate">
                RisholviiY
              </p>
              <p className="text-xs text-[#707070] capitalize truncate">
                {user.role.replace("_", " ")}
              </p>
              {user.role === "admin" && user.adminScopes && user.adminScopes.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 max-w-[200px]">
                  {user.adminScopes.map((scope, idx) => {
                    const inst = scope.institute;
                    const course = scope.course;
                    const instName = typeof inst === "string" ? inst : inst?.shortForm || inst?.name || "Unknown";
                    const courseName = typeof course === "string" ? course : course?.name || "Unknown";
                    return (
                      <span key={idx} className="text-[10px] text-[var(--muted)] font-medium truncate" title={`${instName} - ${courseName}`}>
                        • {instName} ({courseName})
                      </span>
                    );
                  })}
                </div>
              )}
              <span className="text-[9px] text-[var(--muted)] font-semibold leading-none mt-0.5 whitespace-nowrap">
                Design & Developed by Rishabh Bisht
              </span>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              const className = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition w-full ${selected ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:bg-[#f7eef3] hover:text-[var(--brand)]"
                }`;
              if ("href" in item && item.href) {
                return (
                  <Link key={item.id} href={item.href} className={className}>
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={className}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          {user.role === "user" && (
            <div className="px-5 pb-2">
              <button
                onClick={() => setShowOnboarding(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-3 py-2 text-sm font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/10 transition"
              >
                <Settings size={16} />
                Preferences
              </button>
            </div>
          )}
          <div className="px-5 py-4">
            <button
              onClick={() => {
                localStorage.removeItem("pyq_token");
                setToken("");
                setUser(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--brand)]"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </aside>

        <section className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-4 rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-dark)] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-white/75">Welcome back</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-semibold">{user.name}</h1>
                {user.role === "admin" && user.adminScopes && user.adminScopes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {user.adminScopes.map((scope, idx) => {
                      const inst = scope.institute;
                      const course = scope.course;
                      const instName = typeof inst === "string" ? inst : inst?.shortForm || inst?.name || "Unknown";
                      const courseName = typeof course === "string" ? course : course?.name || "Unknown";
                      return (
                        <span key={idx} className="rounded bg-white/20 px-2 py-0.5 text-xs font-medium text-white border border-white/10">
                          Admin: {instName} ({courseName})
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center lg:hidden">
              {user.role === "user" && (
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-white/12 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/18"
                >
                  <Settings size={16} />
                  Preferences
                </button>
              )}
              <button
                onClick={() => {
                  localStorage.removeItem("pyq_token");
                  setToken("");
                  setUser(null);
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-white/12 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/18"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </header>

          {toast && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toast.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {toast.text}
            </div>
          )}

          {active === "overview" && (
            <Overview
              stats={stats}
              isSuper={isSuper}
              user={user}
              pyqs={pyqs}
              subjects={subjects}
              institutes={institutes}
              courses={courses}
              semesters={semesters}
              onView={viewPyq}
              setShowOnboarding={setShowOnboarding}
              tokenUsage={tokenUsage}
              systemStats={systemStats}
              userTokenStatus={userTokenStatus}
              borrowLoading={borrowLoading}
              handleBorrowCredits={handleBorrowCredits}
            />
          )}
          {active === "institutes" && isSuper && (
            <InstitutesPanel institutes={institutes} submit={submitMultipart("/institutes", loadAll, notify, setLoading)} remove={removeItem} update={updateItem} loading={loading} />
          )}
          {active === "courses" && isSuper && (
            <CoursesPanel courses={courses} institutes={institutes} submit={submitJson("/courses", loadAll, notify, setLoading)} remove={removeItem} update={updateItem} loading={loading} />
          )}
          {active === "semesters" && isSuper && (
            <SemestersPanel institutes={institutes} semesters={semesters} courses={courses} submit={submitJson("/semesters", loadAll, notify, setLoading)} remove={removeItem} update={updateItem} loading={loading} />
          )}
          {active === "subjects" && isSuper && (
            <SubjectsPanel
              subjects={subjects}
              institutes={institutes}
              courses={courses}
              semesters={semesters}
              createSubjects={createSubjects}
              remove={removeItem}
              update={updateItem}
              loading={loading}
            />
          )}
          {active === "pyqs" && (
            <PyqsPanel
              pyqs={pyqs}
              institutes={displayedInstitutes}
              courses={displayedCourses}
              semesters={displayedSemesters}
              subjects={displayedSubjects}
              filters={filters}
              setFilters={setFilters}
              submit={submitMultipart("/pyqs", loadAll, notify, setLoading)}
              remove={removeItem}
              loading={loading}
              canManage={user.role === "super_admin" || user.role === "admin"}
              isStudent={user.role === "user"}
              onView={viewPyq}
              user={user}
            />
          )}
          {active === "users" && isSuper && (
            <UsersPanel users={users} courses={courses} institutes={institutes} refresh={loadAll} token={token} notify={notify} />
          )}
          {active === "api-usage" && isSuper && (
            <ApiUsagePanel token={token} authed={authed} notify={notify} />
          )}
        </section>
      </div>
    </main>
  );

  function submitJson(path: string, refresh: () => Promise<void>, show: (toast: Toast) => void, setBusy: (busy: boolean) => void) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const body = Object.fromEntries(form.entries());
      try {
        await authed(path, { method: "POST", body });
        formElement.reset();
        await refresh();
        show({ type: "success", text: "Saved successfully" });
      } catch (error) {
        show({ type: "error", text: (error as Error).message });
      } finally {
        setBusy(false);
      }
    };
  }

  function submitMultipart(path: string, refresh: () => Promise<void>, show: (toast: Toast) => void, setBusy: (busy: boolean) => void) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      try {
        await authed(path, { method: "POST", body: form });
        formElement.reset();
        await refresh();
        show({ type: "success", text: "Uploaded successfully" });
      } catch (error) {
        show({ type: "error", text: (error as Error).message });
      } finally {
        setBusy(false);
      }
    };
  }

  async function removeItem(path: string) {
    if (!confirm("Delete this item and related records where applicable?")) return;
    try {
      await authed(path, { method: "DELETE" });
      await loadAll();
      notify({ type: "success", text: "Deleted successfully" });
    } catch (error) {
      notify({ type: "error", text: (error as Error).message });
    }
  }

  async function updateItem(path: string, body: object) {
    try {
      await authed(path, { method: "PUT", body });
      await loadAll();
      notify({ type: "success", text: "Updated successfully" });
    } catch (error) {
      notify({ type: "error", text: (error as Error).message });
    }
  }

  async function createSubjects(body: object) {
    setLoading(true);
    try {
      await authed("/subjects", { method: "POST", body });
      await loadAll();
      notify({ type: "success", text: "Subjects added successfully" });
    } catch (error) {
      notify({ type: "error", text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function viewPyq(id: string) {
    try {
      await authed(`/pyqs/${id}/view`, { method: "POST" });
      setPyqs((prev) => prev.map((p) => (p._id === id ? { ...p, views: (p.views || 0) + 1 } : p)));
    } catch (error) {
      console.error("Failed to increment views:", error);
    }
  }
}

function AuthScreen({ setToken, notify, toast }: { setToken: (token: string) => void; notify: (toast: Toast) => void; toast: Toast }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const data = await api<{ token: string }>(`/auth/${mode}`, { method: "POST", body });
      localStorage.setItem("pyq_token", data.token);
      setToken(data.token);
    } catch (error) {
      notify({ type: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#FAF0E8] lg:grid-cols-[1.1fr_0.9fr]">

      {/* ===== LEFT - Illustration Panel ===== */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#FAF0E8] p-10">
        {/* Blobs */}
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-[#C95E72]" />
        <div className="absolute top-28 left-3 h-4 w-4 rounded-full bg-[#9B3060]" />
        <div className="absolute top-16 right-16 h-3 w-3 rounded-full bg-[#9B3060]" />
        <div className="absolute top-8 right-20 w-10 h-px bg-[#9B3060] opacity-40 rotate-[-35deg]" />
        <div className="absolute top-14 right-16 w-6 h-px bg-[#9B3060] opacity-30 rotate-[-35deg]" />

        <div className="flex flex-1 items-center justify-center relative">
          <div className="absolute h-64 w-64 rounded-full bg-[#F2D8C8] opacity-70" />
          <div className="absolute left-6 top-[40%] flex gap-1.5 items-center bg-[#7B3060] rounded-xl rounded-bl-sm px-4 py-2.5">
            {[...Array(5)].map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-white" />)}
          </div>
          <div className="absolute right-6 top-[40%] flex gap-1.5 items-center bg-[#7B3060] rounded-xl rounded-br-sm px-4 py-2.5">
            {[...Array(5)].map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-white" />)}
          </div>
          <svg width="180" height="220" viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
            <ellipse cx="80" cy="38" rx="28" ry="32" fill="#F5EDE4" stroke="#D4B8A8" strokeWidth="1.5" />
            <ellipse cx="68" cy="34" rx="8" ry="9" fill="#2C1810" opacity="0.85" />
            <ellipse cx="92" cy="34" rx="8" ry="9" fill="#2C1810" opacity="0.85" />
            <path d="M77 48 L80 43 L83 48" stroke="#C4A090" strokeWidth="1.2" fill="none" />
            <rect x="67" y="54" width="26" height="7" rx="2" fill="#E8DDD5" stroke="#C4A090" strokeWidth="0.8" />
            <line x1="72" y1="54" x2="72" y2="61" stroke="#C4A090" strokeWidth="0.6" />
            <line x1="77" y1="54" x2="77" y2="61" stroke="#C4A090" strokeWidth="0.6" />
            <line x1="82" y1="54" x2="82" y2="61" stroke="#C4A090" strokeWidth="0.6" />
            <line x1="87" y1="54" x2="87" y2="61" stroke="#C4A090" strokeWidth="0.6" />
            <rect x="75" y="68" width="10" height="12" rx="2" fill="#EDE0D4" stroke="#C4A090" strokeWidth="1" />
            <path d="M52 85 Q80 78 108 85" stroke="#C4A090" strokeWidth="1.5" fill="none" />
            <rect x="62" y="85" width="36" height="52" rx="4" fill="#EDE0D4" stroke="#C4A090" strokeWidth="1.2" />
            <path d="M62 97 Q80 91 98 97" stroke="#C4A090" strokeWidth="1" fill="none" />
            <path d="M62 107 Q80 101 98 107" stroke="#C4A090" strokeWidth="1" fill="none" />
            <path d="M62 117 Q80 111 98 117" stroke="#C4A090" strokeWidth="1" fill="none" />
            <path d="M62 127 Q80 121 98 127" stroke="#C4A090" strokeWidth="1" fill="none" />
            <line x1="80" y1="85" x2="80" y2="137" stroke="#C4A090" strokeWidth="1" />
            <path d="M62 90 L38 105 L32 130" stroke="#C4A090" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M32 130 L28 148 L34 148 L36 160 L42 160 L44 148 L48 148 L46 130 Z" fill="#EDE0D4" stroke="#C4A090" strokeWidth="1" />
            <path d="M98 90 L122 105 L128 130" stroke="#C4A090" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M128 130 L124 148 L130 148 L132 160 L138 160 L136 148 L142 148 L128 130 Z" fill="#EDE0D4" stroke="#C4A090" strokeWidth="1" />
            <rect x="44" y="155" width="72" height="42" rx="4" fill="#D0C0B5" stroke="#B0A098" strokeWidth="1.2" />
            <rect x="48" y="158" width="64" height="35" rx="2" fill="#8B7B6E" />
            <circle cx="80" cy="172" r="7" fill="#C4B4A8" stroke="#A09080" strokeWidth="0.8" />
            <ellipse cx="77" cy="170" rx="2" ry="2.5" fill="#6B5040" />
            <ellipse cx="83" cy="170" rx="2" ry="2.5" fill="#6B5040" />
            <rect x="36" y="197" width="88" height="5" rx="2" fill="#B0A098" />
            <ellipse cx="50" cy="196" rx="8" ry="5" fill="#C8621C" transform="rotate(-30 50 196)" />
            <ellipse cx="38" cy="192" rx="7" ry="4" fill="#E88830" transform="rotate(-50 38 192)" />
            <ellipse cx="62" cy="198" rx="6" ry="4" fill="#D4721A" transform="rotate(-10 62 198)" />
            <ellipse cx="110" cy="196" rx="8" ry="5" fill="#C8621C" transform="rotate(30 110 196)" />
            <ellipse cx="122" cy="192" rx="7" ry="4" fill="#E88830" transform="rotate(50 122 192)" />
            <ellipse cx="98" cy="198" rx="6" ry="4" fill="#D4721A" transform="rotate(10 98 198)" />
          </svg>
        </div>

        <div className="relative z-10 text-center">
          <h2 className="text-lg font-semibold text-[#7B3060]">Turn your ideas into reality.</h2>
          <p className="mt-1 text-sm text-[#A06080]">Start for free and get attractive offers from the community</p>
        </div>
      </section>

      {/* ===== RIGHT - Form Panel ===== */}
      <section className="flex items-center justify-center bg-white min-h-screen lg:min-h-0 p-5">
        <div className="w-full max-w-sm">

          {/* Brand Logo */}
          <div className="mb-8 flex items-center gap-2">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-[#9B3060]" />
              <div className="h-2.5 w-2.5 rounded-sm bg-[#D4A0B8]" />
              <div className="h-2.5 w-2.5 rounded-sm bg-[#D4A0B8]" />
              <div className="h-2.5 w-2.5 rounded-sm bg-[#9B3060]" />
            </div>
            <span className="text-sm font-medium text-gray-800">RisholviiY</span>
          </div>

          {/* Mobile — mini illustration strip (only on small screens) */}
          <div className="lg:hidden mb-6 rounded-2xl bg-[#FAF0E8] px-6 py-8 flex flex-col items-center relative overflow-hidden">
            {/* mini blobs */}
            <div className="absolute -top-4 -left-4 h-16 w-16 rounded-full bg-[#C95E72] opacity-80" />
            <div className="absolute top-3 right-8 h-2.5 w-2.5 rounded-full bg-[#9B3060]" />
            <div className="absolute bottom-4 right-4 h-2 w-2 rounded-full bg-[#D4A0B8]" />

            {/* mini circle bg */}
            <div className="absolute h-32 w-32 rounded-full bg-[#F2D8C8] opacity-60 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

            {/* mini skeleton */}
            <svg width="90" height="110" viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
              <ellipse cx="80" cy="38" rx="28" ry="32" fill="#F5EDE4" stroke="#D4B8A8" strokeWidth="1.5" />
              <ellipse cx="68" cy="34" rx="8" ry="9" fill="#2C1810" opacity="0.85" />
              <ellipse cx="92" cy="34" rx="8" ry="9" fill="#2C1810" opacity="0.85" />
              <path d="M77 48 L80 43 L83 48" stroke="#C4A090" strokeWidth="1.2" fill="none" />
              <rect x="67" y="54" width="26" height="7" rx="2" fill="#E8DDD5" stroke="#C4A090" strokeWidth="0.8" />
              <line x1="72" y1="54" x2="72" y2="61" stroke="#C4A090" strokeWidth="0.6" />
              <line x1="77" y1="54" x2="77" y2="61" stroke="#C4A090" strokeWidth="0.6" />
              <line x1="82" y1="54" x2="82" y2="61" stroke="#C4A090" strokeWidth="0.6" />
              <line x1="87" y1="54" x2="87" y2="61" stroke="#C4A090" strokeWidth="0.6" />
              <rect x="75" y="68" width="10" height="12" rx="2" fill="#EDE0D4" stroke="#C4A090" strokeWidth="1" />
              <path d="M52 85 Q80 78 108 85" stroke="#C4A090" strokeWidth="1.5" fill="none" />
              <rect x="62" y="85" width="36" height="52" rx="4" fill="#EDE0D4" stroke="#C4A090" strokeWidth="1.2" />
              <path d="M62 97 Q80 91 98 97" stroke="#C4A090" strokeWidth="1" fill="none" />
              <path d="M62 107 Q80 101 98 107" stroke="#C4A090" strokeWidth="1" fill="none" />
              <path d="M62 117 Q80 111 98 117" stroke="#C4A090" strokeWidth="1" fill="none" />
              <line x1="80" y1="85" x2="80" y2="137" stroke="#C4A090" strokeWidth="1" />
              <path d="M62 90 L38 105 L32 130" stroke="#C4A090" strokeWidth="6" strokeLinecap="round" fill="none" />
              <path d="M98 90 L122 105 L128 130" stroke="#C4A090" strokeWidth="6" strokeLinecap="round" fill="none" />
              <rect x="44" y="155" width="72" height="42" rx="4" fill="#D0C0B5" stroke="#B0A098" strokeWidth="1.2" />
              <rect x="48" y="158" width="64" height="35" rx="2" fill="#8B7B6E" />
              <ellipse cx="50" cy="196" rx="8" ry="5" fill="#C8621C" transform="rotate(-30 50 196)" />
              <ellipse cx="38" cy="192" rx="7" ry="4" fill="#E88830" transform="rotate(-50 38 192)" />
              <ellipse cx="110" cy="196" rx="8" ry="5" fill="#C8621C" transform="rotate(30 110 196)" />
              <ellipse cx="122" cy="192" rx="7" ry="4" fill="#E88830" transform="rotate(50 122 192)" />
            </svg>

            <p className="relative z-10 mt-3 text-sm font-semibold text-[#7B3060]">
              Ace your exams with previous year questions.
            </p>

          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-gray-900">
            {mode === "login" ? "Login to your Account" : "Create account"}
          </h2>
          <p className="mt-1 mb-6 text-sm text-gray-400">
            Track your exam preparation and performance in one place
          </p>

          {/* Toast */}
          {toast && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {toast.text}
            </div>
          )}

          {/* Google Sign In */}
          < a
            href={`${API_URL}/auth/google`}
            className="flex items-center justify-center gap-2.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.99] transition-all cursor-pointer select-none shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </a>

          {/* Switch mode */}
          <p className="mt-6 text-center text-xs text-gray-400">
            {mode === "login" ? "Not Registered Yet? " : "Already registered? "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-semibold text-[#9B3060] hover:underline"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          {/* Premium Aesthetic Floating Developed Badge */}
          <div className="group fixed bottom-5 right-5 z-50 flex flex-col items-end gap-1.5">



          </div>

        </div>
      </section>

    </main>
  );
}

function ExamTypeBadge({ type }: { type: string }) {
  const normType = (type || "").trim();

  let colors = {
    bg: "bg-purple-50 text-purple-700 border-purple-100", // Fallback / End Semester
    label: normType || "End Semester Exam"
  };

  switch (normType) {
    case "Mid Semester Exam":
      colors = { bg: "bg-blue-50 text-blue-700 border-blue-100", label: "Mid Semester" };
      break;
    case "End Semester Exam":
      colors = { bg: "bg-purple-50 text-purple-700 border-purple-100", label: "End Semester" };
      break;
    case "Sessional Exam":
      colors = { bg: "bg-amber-50 text-amber-800 border-amber-100", label: "Sessional" };
      break;
    case "Unit Test":
      colors = { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", label: "Unit Test" };
      break;
    case "Internal Exam":
      colors = { bg: "bg-teal-50 text-teal-700 border-teal-100", label: "Internal" };
      break;
    case "External Exam":
      colors = { bg: "bg-rose-50 text-rose-700 border-rose-100", label: "External" };
      break;
    case "Practical Exam":
      colors = { bg: "bg-cyan-50 text-cyan-700 border-cyan-100", label: "Practical" };
      break;
    case "Lab Exam":
      colors = { bg: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100", label: "Lab Exam" };
      break;
  }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold border ${colors.bg}`}>
      {colors.label}
    </span>
  );
}

function Overview({
  stats,
  isSuper,
  user,
  pyqs,
  subjects,
  institutes,
  courses,
  semesters,
  onView,
  setShowOnboarding,
  tokenUsage,
  systemStats,
  userTokenStatus,
  borrowLoading,
  handleBorrowCredits,
}: {
  stats: (string | number)[][];
  isSuper: boolean;
  user: User;
  pyqs: Pyq[];
  subjects: Subject[];
  institutes: Institute[];
  courses: Course[];
  semesters: Semester[];
  onView?: (id: string) => void;
  setShowOnboarding: (show: boolean) => void;
  tokenUsage?: { totalToday: number; dailyLimit: number; percentage: number } | null;
  systemStats?: any | null;
  userTokenStatus: any;
  borrowLoading: boolean;
  handleBorrowCredits: () => Promise<void>;
}) {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Filter subjects matching current user's semester
  const mySubjects = useMemo(() => {
    if (user.role !== "user" && user.role !== "admin") return [];
    return subjects.filter((s) => {
      const semId = typeof s.semester === "string" ? s.semester : s.semester?._id;
      return semId === user.semester;
    });
  }, [subjects, user.semester, user.role]);

  // Filter question papers matching selected subject locally
  const displayedPyqs = useMemo(() => {
    if (user.role !== "user" && user.role !== "admin") return pyqs;
    if (!selectedSubject) return pyqs;
    return pyqs.filter((p) => {
      const subId = typeof p.subject === "string" ? p.subject : p.subject?._id;
      return subId === selectedSubject;
    });
  }, [pyqs, selectedSubject, user.role]);

  const currentInst = useMemo(() => institutes.find((i) => i._id === user.institute), [institutes, user.institute]);
  const currentCourse = useMemo(() => courses.find((c) => c._id === user.course), [courses, user.course]);
  const currentSem = useMemo(() => semesters.find((s) => s._id === user.semester), [semesters, user.semester]);

  if (user.role === "user" || user.role === "admin") {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
        {user.role === "admin" && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm font-semibold text-amber-800 backdrop-blur-sm flex items-center gap-2.5 shadow-sm">
            <span className="text-lg">🛡️</span>
            <span>You are an admin of this institute and course.</span>
          </div>
        )}

        {/* Profile & AI Credit Analytics Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card Banner */}

          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl text-white shadow-xl transition-all duration-300 hover:shadow-[0_12px_30px_rgba(var(--brand-dark-rgb),0.25)]"
            style={{ background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 55%, var(--brand-accent) 100%)" }}>

            {/* Decorative blobs */}
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 h-40 w-40 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(var(--soft-accent-rgb),0.12)" }} />
            <div className="absolute top-4 right-16 h-2 w-2 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute bottom-6 right-40 h-1.5 w-1.5 rounded-full bg-white/8 pointer-events-none" />

            <div className="relative z-10 p-5 sm:p-8 flex flex-col gap-4">

              {/* ── Row 1: Logo + Badge / Name ── */}
              <div className="flex items-center gap-4">
                {/* Institute Logo */}
                <div className="h-[68px] w-[68px] shrink-0 rounded-[16px] p-2 flex items-center justify-center border border-white/20 shadow-[0_4px_16px_rgba(var(--brand-dark-rgb),0.3)]"
                  style={{ background: "var(--soft-accent)" }}>
                  {currentInst?.logoUrl ? (
                    <img src={asset(currentInst.logoUrl)} alt={currentInst.name}
                      className="object-contain max-h-full max-w-full" />
                  ) : (
                    <div className="grid h-full w-full place-items-center rounded-xl text-xl font-black uppercase"
                      style={{ background: "rgba(var(--brand-rgb),0.10)", color: "var(--brand)" }}>
                      {currentInst?.shortForm || currentInst?.name?.slice(0, 2) || "U"}
                    </div>
                  )}
                </div>

                {/* Name + Badge */}
                <div className="flex flex-col gap-1.5 min-w-0">
                  {user.role === "admin" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase w-fit"
                      style={{ background: "rgba(255,255,255,0.22)", border: "0.5px solid rgba(255,255,255,0.35)", backdropFilter: "blur(10px)" }}>
                      <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                      Institute Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase w-fit"
                      style={{ background: "rgba(255,255,255,0.15)", border: "0.5px solid rgba(255,255,255,0.22)", backdropFilter: "blur(10px)" }}>
                      <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--soft-accent)" }} />
                      Active Academic Profile
                    </span>
                  )}
                  <h2 className="text-[22px] sm:text-3xl font-extrabold tracking-tight text-white leading-tight truncate">
                    {user.name} !
                  </h2>
                </div>
              </div>

              {/* ── Row 2: College full-width ── */}
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-2.5"
                style={{ background: "rgba(255,255,255,0.10)", border: "0.5px solid rgba(255,255,255,0.16)" }}>
                <span className="text-[11px] font-medium text-white/200 shrink-0">College:</span>
                <span className="text-sm font-bold text-white truncate">{currentInst?.name ?? "Not Setup"}</span>
              </div>

              {/* ── Row 3: Course + Semester side-by-side ── */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Course", value: currentCourse?.name ?? "Not Setup" },
                  { label: "Semester", value: currentSem?.name ?? "Not Setup" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5 rounded-xl px-3.5 py-2.5"
                    style={{ background: "rgba(255,255,255,0.10)", border: "0.5px solid rgba(255,255,255,0.16)" }}>
                    <span className="text-[9px] font-semibold text-white/50 uppercase tracking-wide">{label}</span>
                    <span className="text-sm font-bold text-white truncate">{value}</span>
                  </div>
                ))}
              </div>

              {/* ── Row 4: CTA Button ── */}
              <button onClick={() => setShowOnboarding(true)}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200 active:scale-95 cursor-pointer w-full"
                style={{ background: "var(--soft-accent)", color: "var(--brand-dark)", boxShadow: "0 4px 14px rgba(var(--brand-dark-rgb),0.22)" }}>
                <Settings size={15} />
                Change Details
              </button>
            </div>
          </div>

          {/* User AI Token Usage Analytics Card */}
          {userTokenStatus && (
            <div className="rounded-lg border border-[var(--line)] bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-850">
                    <Sparkles size={16} className="text-[var(--brand)] animate-pulse" />
                    <span>AI Assistant Analytics</span>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 tracking-wider">
                    Active
                  </span>
                </div>

                {/* 1. Usage Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Requests</p>
                    <p className="text-xl font-extrabold text-gray-800 mt-1">
                      {((userTokenStatus as any).userSummary?.totalRequests || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tokens Consumed</p>
                    <p className="text-xl font-extrabold text-gray-800 mt-1">
                      {((userTokenStatus as any).userSummary?.totalTokens || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* 2. Cost Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estimated Cost</span>
                    <span className="text-lg font-black text-[var(--brand)]">
                      ₹{(((userTokenStatus as any).userSummary?.totalCost || 0) * 83.5).toFixed(4)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Cost by API Provider</p>

                  <div className="space-y-1.5">
                    {[
                      { name: "Gemini", apiName: "gemini" },
                      { name: "Groq", apiName: "groq" },
                      { name: "OpenRouter", apiName: "openrouter" }
                    ].map((provider) => {
                      const breakdown = (userTokenStatus as any).costBreakdown?.find(
                        (b: any) => String(b.apiName).toLowerCase() === provider.apiName
                      );
                      const cost = breakdown ? breakdown.cost : 0;
                      const tokens = breakdown ? breakdown.tokensUsed : 0;
                      return (
                        <div key={provider.apiName} className="flex items-center justify-between text-xs p-2 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="font-bold text-gray-700">{provider.name}</span>
                          <div className="text-right">
                            <span className="font-semibold text-gray-600 block">₹{(cost * 83.5).toFixed(4)}</span>
                            <span className="text-[9px] text-gray-400">{tokens.toLocaleString()} tokens</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. App-wide Lifetime Cost Summary */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-450 font-bold uppercase tracking-wider text-[9px]">Global App AI Cost</span>
                  <span className="font-extrabold text-gray-700">
                    ₹{(((userTokenStatus as any).appSummary?.totalCost || 0) * 83.5).toFixed(4)}
                  </span>
                </div>

                {/* Transparency message */}
                <div className="rounded-xl bg-blue-50/60 p-3.5 text-[10px] font-semibold text-blue-800 border border-blue-100 leading-relaxed flex items-start gap-1.5">
                  <span className="text-xs leading-none shrink-0">💡</span>
                  <span>It’s completely free for you, but we are monitoring total AI usage cost generated by your activity in this application.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {isSuper && tokenUsage && (
        <div className="rounded-lg border border-[var(--line)] bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Sparkles size={20} className="text-[var(--brand)] animate-pulse" />
                AI Token Usage (Today)
              </h3>
              <p className="text-xs text-[var(--muted)] mt-1">
                Monitors real-time consumption of LLM tokens against your daily allocation.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-2xl font-black text-[var(--brand)]">
                {tokenUsage.totalToday.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-gray-400"> / {tokenUsage.dailyLimit.toLocaleString()} tokens</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
              <span>Usage Percentage</span>
              <span className={`${tokenUsage.percentage > 85 ? 'text-rose-600 font-extrabold' : 'text-[var(--brand)]'}`}>
                {tokenUsage.percentage}% consumed
              </span>
            </div>

            <div className="relative h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${tokenUsage.percentage > 85
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                  : 'bg-gradient-to-r from-[var(--brand)] to-[var(--brand-dark)]'
                  }`}
                style={{ width: `${tokenUsage.percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {isSuper && systemStats && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* MongoDB Metrics Card */}
          <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-50 text-green-600 border border-green-100">
                  <Database size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">MongoDB Database</h3>
                  <p className="text-[10px] text-gray-400">Total stored collection metrics</p>
                </div>
              </div>
              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider border ${systemStats.db?.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                {systemStats.db?.ok ? 'Connected' : 'Offline'}
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col justify-center">
                  <span className="text-[9px] font-extrabold uppercase text-gray-400 tracking-wider">Total Documents</span>
                  <span className="text-lg font-black text-gray-700 mt-0.5">{(systemStats.db?.objects || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col justify-center">
                  <span className="text-[9px] font-extrabold uppercase text-gray-400 tracking-wider">Collections</span>
                  <span className="text-lg font-black text-gray-700 mt-0.5">{systemStats.db?.collections || 0}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Data Size</span>
                  <span className="text-gray-700 font-semibold">{formatBytes(systemStats.db?.dataSize || 0)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Storage Size</span>
                  <span className="text-gray-700 font-semibold">{formatBytes(systemStats.db?.storageSize || 0)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Index Size</span>
                  <span className="text-gray-700 font-semibold">{formatBytes(systemStats.db?.indexSize || 0)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold">
                <span className="text-gray-400 text-[10px]">Total Database Footprint</span>
                <span className="text-[var(--brand)] font-extrabold">{formatBytes((systemStats.db?.storageSize || 0) + (systemStats.db?.indexSize || 0))}</span>
              </div>
            </div>
          </div>

          {/* Cloudinary Metrics Card */}
          <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                  <Cloud size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Cloudinary Assets</h3>
                  <p className="text-[10px] text-gray-400">PDFs, images & logo storage</p>
                </div>
              </div>
              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider border ${systemStats.cloudinary?.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                {systemStats.cloudinary?.ok ? `${systemStats.cloudinary?.plan} Plan` : 'Config Error'}
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col justify-center">
                  <span className="text-[9px] font-extrabold uppercase text-gray-400 tracking-wider">Total Hosted Files</span>
                  <span className="text-lg font-black text-gray-700 mt-0.5">{(systemStats.cloudinary?.resources || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col justify-center">
                  <span className="text-[9px] font-extrabold uppercase text-gray-400 tracking-wider">Storage Used %</span>
                  <span className="text-lg font-black text-gray-700 mt-0.5">{(systemStats.cloudinary?.storage?.used_percent || 0).toFixed(2)}%</span>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="space-y-3">
                {/* 1. Storage */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>Cloud Storage Occupancy</span>
                    <span className="text-gray-700">
                      {formatBytes(systemStats.cloudinary?.storage?.usage || 0)} / {formatBytes(systemStats.cloudinary?.storage?.limit || 0)}
                    </span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                      style={{ width: `${Math.min(100, systemStats.cloudinary?.storage?.used_percent || 0)}%` }}
                    />
                  </div>
                </div>

                {/* 2. Bandwidth */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>Monthly Bandwidth Usage</span>
                    <span className="text-gray-700">
                      {formatBytes(systemStats.cloudinary?.bandwidth?.usage || 0)} / {formatBytes(systemStats.cloudinary?.bandwidth?.limit || 0)}
                    </span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 transition-all duration-500"
                      style={{ width: `${Math.min(100, systemStats.cloudinary?.bandwidth?.used_percent || 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{isSuper ? "Complete system control" : "Assigned course workspace"}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {isSuper
            ? "You can create and remove hierarchy records, assign admins, and manage every uploaded PYQ."
            : `Your account can upload and manage PYQs only for ${user.adminScopes?.length || 0} assigned course scope(s).`}
        </p>
      </div>
      <DataTable
        title="Recent PYQs"
        rows={pyqs.slice(0, 6)}
        columns={["Subject Code", "Course", "Subject", "Year"]}
        render={(pyq) => [pyq.title, pyq.course?.name, pyq.subject?.name, pyq.year]}
      />
    </div>
  );
}

function InstitutesPanel({ institutes, submit, remove, update, loading }: { institutes: Institute[]; submit: (event: FormEvent<HTMLFormElement>) => void; remove: (path: string) => void; update: (path: string, body: object) => void; loading: boolean }) {
  return (
    <Panel title="Institute Management">
      <FormGrid onSubmit={submit}>
        <Input name="name" label="Institute Name" required />
        <Input name="shortForm" label="Short Form" required />
        <Input name="logoUrl" label="Logo URL" type="url" placeholder="https://example.com/logo.png" />
        <Input name="logo" label="Logo" type="file" accept="image/*" />
        <Submit loading={loading} label="Add Institute" />
      </FormGrid>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {institutes.map((institute) => (
          <div key={institute._id} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-[#f7eef3] font-semibold text-[var(--brand)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {institute.logoUrl ? <img src={asset(institute.logoUrl)} alt="" className="h-full w-full object-cover" /> : institute.shortForm}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{institute.name}</p>
              <p className="text-sm text-[var(--muted)]">{institute.shortForm}</p>
            </div>
            <IconEdit onClick={() => {
              const name = prompt("Institute name", institute.name);
              const shortForm = prompt("Short form", institute.shortForm || "");
              const logoUrl = prompt("Logo URL", institute.logoUrl || "");
              if (name && shortForm) update(`/institutes/${institute._id}`, { name, shortForm, logoUrl });
            }} />
            <IconDelete onClick={() => remove(`/institutes/${institute._id}`)} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CoursesPanel({ courses, institutes, submit, remove, update, loading }: { courses: Course[]; institutes: Institute[]; submit: (event: FormEvent<HTMLFormElement>) => void; remove: (path: string) => void; update: (path: string, body: object) => void; loading: boolean }) {
  return (
    <Panel title="Course Management">
      <FormGrid onSubmit={submit}>
        <Select name="institute" label="Institute" options={institutes.map((item) => [item._id, `${item.shortForm} - ${item.name}`])} required />
        <Input name="name" label="Course Name" required />
        <Submit loading={loading} label="Add Course" />
      </FormGrid>
      <DataTable title="Courses" rows={courses} columns={["Course", "Institute", ""]} render={(course) => [course.name, course.institute?.shortForm, <RowActions key="actions" edit={() => {
        const name = prompt("Course name", course.name);
        if (name) update(`/courses/${course._id}`, { name, institute: course.institute._id });
      }} remove={() => remove(`/courses/${course._id}`)} />]} />
    </Panel>
  );
}

function SemestersPanel({ institutes, semesters, courses, submit, remove, update, loading }: { institutes: Institute[]; semesters: Semester[]; courses: Course[]; submit: (event: FormEvent<HTMLFormElement>) => void; remove: (path: string) => void; update: (path: string, body: object) => void; loading: boolean }) {
  const [selectedInstitute, setSelectedInstitute] = useState("");
  const filteredCourses = courses.filter((course) => course.institute?._id === selectedInstitute);

  return (
    <Panel title="Semester Management">
      <FormGrid onSubmit={submit}>
        <Select name="instituteFilter" label="Institute" value={selectedInstitute} onChange={setSelectedInstitute} options={institutes.map((item) => [item._id, `${item.shortForm} - ${item.name}`])} required />
        <Select name="course" label="Course" options={filteredCourses.map((item) => [item._id, item.name])} required disabled={!selectedInstitute} />
        <Input name="name" label="Semester Name" required />
        <Input name="number" label="Number" type="number" min="1" max="12" required />
        <Submit loading={loading} label="Add Semester" />
      </FormGrid>
      <DataTable title="Semesters" rows={semesters} columns={["Semester", "Number", "Course", ""]} render={(semester) => [semester.name, semester.number, semester.course?.name, <RowActions key="actions" edit={() => {
        const name = prompt("Semester name", semester.name);
        const number = prompt("Semester number", String(semester.number));
        if (name && number) update(`/semesters/${semester._id}`, { name, number });
      }} remove={() => remove(`/semesters/${semester._id}`)} />]} />
    </Panel>
  );
}

function SubjectsPanel({
  subjects,
  institutes,
  courses,
  semesters,
  createSubjects,
  remove,
  update,
  loading,
}: {
  subjects: Subject[];
  institutes: Institute[];
  courses: Course[];
  semesters: Semester[];
  createSubjects: (body: object) => Promise<void>;
  remove: (path: string) => void;
  update: (path: string, body: object) => void;
  loading: boolean;
}) {
  const [selectedInstitute, setSelectedInstitute] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [year, setYear] = useState("");
  const [subjectRows, setSubjectRows] = useState([{ name: "", code: "" }]);

  const filteredCourses = courses.filter((course) => course.institute?._id === selectedInstitute);
  const filteredSemesters = semesters.filter((semester) => semester.course?._id === selectedCourse);

  async function submitSubjects(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedSubjects = subjectRows
      .map((subject) => ({ name: subject.name.trim(), code: subject.code.trim() }))
      .filter((subject) => subject.name);

    await createSubjects({
      semester: selectedSemester,
      year,
      subjects: cleanedSubjects,
    });

    setSubjectRows([{ name: "", code: "" }]);
  }

  function updateSubjectRow(index: number, field: "name" | "code", value: string) {
    setSubjectRows((current) =>
      current.map((subject, subjectIndex) =>
        subjectIndex === index ? { ...subject, [field]: value } : subject
      )
    );
  }

  return (
    <Panel title="Subject Management">
      <form onSubmit={submitSubjects} className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            name="institute"
            label="Institute"
            value={selectedInstitute}
            onChange={(value) => {
              setSelectedInstitute(value);
              setSelectedCourse("");
              setSelectedSemester("");
            }}
            options={institutes.map((item) => [item._id, `${item.shortForm} - ${item.name}`])}
            required
          />
          <Select
            name="course"
            label="Course"
            value={selectedCourse}
            onChange={(value) => {
              setSelectedCourse(value);
              setSelectedSemester("");
            }}
            options={filteredCourses.map((item) => [item._id, item.name])}
            required
            disabled={!selectedInstitute}
          />
          <Select
            name="semester"
            label="Semester"
            value={selectedSemester}
            onChange={setSelectedSemester}
            options={filteredSemesters.map((item) => [item._id, item.name])}
            required
            disabled={!selectedCourse}
          />
          <Input name="year" label="Year" type="number" min="1990" max="2100" value={year} onChange={setYear} placeholder="2025" required />
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--line)]">
          <div className="grid grid-cols-[1fr_180px_44px] gap-0 bg-[#faf7f9] px-3 py-2 text-sm font-semibold text-[var(--muted)]">
            <span>Subject Name</span>
            <span>Subject Code</span>
            <span />
          </div>
          <div className="divide-y divide-[var(--line)]">
            {subjectRows.map((subject, index) => (
              <div key={index} className="grid grid-cols-[1fr_180px_44px] items-center gap-2 p-3">
                <input
                  value={subject.name}
                  onChange={(event) => updateSubjectRow(index, "name", event.target.value)}
                  placeholder="Data Structures"
                  required={index === 0}
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                />
                <input
                  value={subject.code}
                  onChange={(event) => updateSubjectRow(index, "code", event.target.value)}
                  placeholder="BCA301"
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm uppercase outline-none focus:border-[var(--brand)]"
                />
                <button
                  type="button"
                  onClick={() => setSubjectRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  disabled={subjectRows.length === 1}
                  className="grid h-10 w-10 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Remove subject row"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => setSubjectRows((current) => [...current, { name: "", code: "" }])}
            className="rounded-lg border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--brand)] hover:bg-[#f7eef3]"
          >
            Add More Subject
          </button>
          <Submit loading={loading} label="Save Subjects" />
        </div>
      </form>

      <DataTable title="Subjects" rows={subjects} columns={["Subject", "Code", "Institute", "Course", "Semester", "Year", ""]} render={(subject) => [subject.name, subject.code || "-", subject.institute?.shortForm || "-", subject.course?.name || "-", subject.semester?.name, subject.year || "-", <RowActions key="actions" edit={() => {
        const name = prompt("Subject name", subject.name);
        const code = prompt("Subject code", subject.code || "");
        const nextYear = prompt("Year", subject.year ? String(subject.year) : "");
        if (name) update(`/subjects/${subject._id}`, { name, code, year: nextYear });
      }} remove={() => remove(`/subjects/${subject._id}`)} />]} />
    </Panel>
  );
}

function PyqsPanel(props: {
  pyqs: Pyq[];
  institutes: Institute[];
  courses: Course[];
  semesters: Semester[];
  subjects: Subject[];
  filters: PyqFilters;
  setFilters: (filters: PyqFilters) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  remove: (path: string) => void;
  loading: boolean;
  canManage: boolean;
  isStudent?: boolean;
  onView?: (id: string) => void;
  user: User;
}) {
  const { pyqs, institutes, courses, semesters, subjects, filters, setFilters, submit, remove, loading, canManage, isStudent, onView, user } = props;
  const [uploadInstitute, setUploadInstitute] = useState("");
  const [uploadCourse, setUploadCourse] = useState("");
  const [uploadSemester, setUploadSemester] = useState("");
  const [uploadSubjectYear, setUploadSubjectYear] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [searchText, setSearchText] = useState("");

  const allowedInstitutes = useMemo(() => {
    if (user.role !== "admin" || !user.adminScopes) return institutes;
    const allowedIds = user.adminScopes.map((scope: any) =>
      typeof scope.institute === "string" ? scope.institute : scope.institute?._id
    );
    return institutes.filter((inst) => allowedIds.includes(inst._id));
  }, [user, institutes]);

  const allowedCourses = useMemo(() => {
    const baseCourses = courses.filter((c) => getIdStr(c.institute) === uploadInstitute);
    if (user.role !== "admin" || !user.adminScopes) return baseCourses;
    const allowedIds = user.adminScopes.map((scope: any) => getIdStr(scope.course));
    return baseCourses.filter((course) => allowedIds.includes(getIdStr(course)));
  }, [user, courses, uploadInstitute]);

  const uploadSemesters = semesters.filter((s) => getIdStr(s.course) === uploadCourse);
  const uploadSubjects = subjects.filter(
    (s) => getIdStr(s.course) === uploadCourse && getIdStr(s.semester) === uploadSemester &&
      (!uploadSubjectYear || String(s.year || "") === uploadSubjectYear)
  );
  const uploadSubjectYears = Array.from(new Set(
    subjects.filter((s) => getIdStr(s.course) === uploadCourse && getIdStr(s.semester) === uploadSemester && s.year)
      .map((s) => String(s.year))
  )).sort((a, b) => Number(b) - Number(a));

  const filterCourses = courses.filter((c) => !filters.institute || getIdStr(c.institute) === filters.institute);
  const filterSemesters = semesters.filter((s) => !filters.course || getIdStr(s.course) === filters.course);
  const filterSubjects = subjects.filter(
    (s) =>
      (!filters.institute || getIdStr(s.institute) === filters.institute) &&
      (!filters.course || getIdStr(s.course) === filters.course) &&
      (!filters.semester || getIdStr(s.semester) === filters.semester) &&
      (!filters.subjectYear || String(s.year || "") === filters.subjectYear)
  );
  const subjectYears = Array.from(new Set(
    subjects.filter(
      (s) =>
        (!filters.institute || getIdStr(s.institute) === filters.institute) &&
        (!filters.course || getIdStr(s.course) === filters.course) &&
        (!filters.semester || getIdStr(s.semester) === filters.semester) &&
        s.year
    ).map((s) => String(s.year))
  )).sort((a, b) => Number(b) - Number(a));

  // Final filtered + searched pyqs
  const filteredPyqs = pyqs.filter((p) => {
    const matchInst = !filters.institute || getIdStr(p.institute) === filters.institute;
    const matchCourse = !filters.course || getIdStr(p.course) === filters.course;
    const matchSem = !filters.semester || getIdStr(p.semester) === filters.semester;
    const matchSubject = !filters.subject || getIdStr(p.subject) === filters.subject;
    const matchYear = !filters.year || String(p.year) === filters.year;
    const matchSearch = !searchText ||
      p.subject?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      p.title?.toLowerCase().includes(searchText.toLowerCase()) ||
      String(p.year).includes(searchText) ||
      p.examType?.toLowerCase().includes(searchText.toLowerCase());
    return matchInst && matchCourse && matchSem && matchSubject && matchYear && matchSearch;
  });

  // Group by subject name for the card grid
  const grouped = filteredPyqs.reduce<Record<string, Pyq[]>>((acc, p) => {
    const key = p.subject?.name || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const examTypeColors: Record<string, string> = {
    "Mid Semester Exam": "bg-blue-50 text-blue-700 border-blue-100",
    "End Semester Exam": "bg-purple-50 text-purple-700 border-purple-100",
    "Sessional Exam": "bg-amber-50 text-amber-800 border-amber-100",
    "Unit Test": "bg-emerald-50 text-emerald-700 border-emerald-100",
    "Internal Exam": "bg-teal-50 text-teal-700 border-teal-100",
    "External Exam": "bg-rose-50 text-rose-700 border-rose-100",
    "Practical Exam": "bg-cyan-50 text-cyan-700 border-cyan-100",
    "Lab Exam": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100",
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-[var(--brand)]" />
            Question Papers
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{filteredPyqs.length} paper{filteredPyqs.length !== 1 ? "s" : ""} found</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 cursor-pointer shadow-sm"
            style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
          >
            <FileUp size={15} />
            {showUpload ? "Hide Upload" : "Upload PYQ"}
          </button>
        )}
      </div>

      {/* ── Upload Form ── */}
      {canManage && showUpload && (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <FileUp size={15} className="text-[var(--brand)]" /> Upload New PYQ
          </h3>
          <form onSubmit={(e) => { submit(e); setShowUpload(false); }} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select name="uploadInstitute" label="Institute" value={uploadInstitute}
              onChange={(v) => { setUploadInstitute(v); setUploadCourse(""); setUploadSemester(""); setUploadSubjectYear(""); }}
              options={allowedInstitutes.map((i) => [i._id, i.shortForm || i.name])} required />
            <Select name="uploadCourse" label="Course" value={uploadCourse}
              onChange={(v) => { setUploadCourse(v); setUploadSemester(""); setUploadSubjectYear(""); }}
              options={allowedCourses.map((c) => [c._id, c.name])} required disabled={!uploadInstitute} />
            <Select name="uploadSemester" label="Semester" value={uploadSemester}
              onChange={(v) => { setUploadSemester(v); setUploadSubjectYear(""); }}
              options={uploadSemesters.map((s) => [s._id, s.name])} required disabled={!uploadCourse} />
            <Select name="uploadSubjectYear" label="Subject Year" value={uploadSubjectYear}
              onChange={setUploadSubjectYear} options={uploadSubjectYears.map((y) => [y, y])} required disabled={!uploadSemester} />
            <Select name="subject" label="Subject"
              options={uploadSubjects.map((s) => [s._id, `${s.name}${s.code ? ` · ${s.code}` : ""}`])} required disabled={!uploadSubjectYear} />
            <Input name="year" label="PYQ Year" type="number" required />
            <Select name="examType" label="Exam Type"
              options={[
                ["Mid Semester Exam", "Mid Semester Exam"], ["End Semester Exam", "End Semester Exam"],
                ["Sessional Exam", "Sessional Exam"], ["Unit Test", "Unit Test"],
                ["Internal Exam", "Internal Exam"], ["External Exam", "External Exam"],
                ["Practical Exam", "Practical Exam"], ["Lab Exam", "Lab Exam"],
              ]} required defaultValue="End Semester Exam" />
            <Input name="pdf" label="PDF File" type="file" accept="application/pdf" required />
            <div className="sm:col-span-2 xl:col-span-4 flex justify-end">
              <Submit loading={loading} label="Upload PYQ" />
            </div>
          </form>
        </div>
      )}

      {/* ── Search + Filters ── */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search subject, exam type or year…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--line)] outline-none focus:border-[var(--brand)] bg-gray-50/50 focus:bg-white transition"
          />
        </div>
        {/* Only Subject + PYQ Year dropdowns */}
        <div className="grid grid-cols-2 gap-2">
          <Select compact name="fsub" label="Subject" value={filters.subject}
            onChange={(v) => setFilters({ ...filters, subject: v })}
            options={filterSubjects.map((s) => [s._id, s.name])} />
          <Input compact name="fy" label="PYQ Year" value={filters.year}
            onChange={(v) => setFilters({ ...filters, year: v })} />
        </div>
        {/* Active filter chips */}
        {(filters.subject || filters.year || searchText) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              filters.subject && subjects.find((s) => s._id === filters.subject)?.name,
              filters.year && `Year ${filters.year}`,
              searchText && `"${searchText}"`,
            ].filter(Boolean).map((chip, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--brand)]/8 text-[var(--brand)] px-2.5 py-0.5 text-[10px] font-bold border border-[var(--brand)]/15">
                {chip}
              </span>
            ))}
            <button
              onClick={() => {
                if (isStudent && user) {
                  setFilters({
                    institute: user.institute || "",
                    course: user.course || "",
                    semester: user.semester || "",
                    subjectYear: "",
                    subject: "",
                    year: ""
                  });
                } else {
                  setFilters({ institute: "", course: "", semester: "", subjectYear: "", subject: "", year: "" });
                }
                setSearchText("");
              }}
              className="text-[10px] font-bold text-gray-400 hover:text-gray-600 underline cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Results: grouped by subject ── */}
      {filteredPyqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[var(--line)] bg-white">
          <BookOpen size={36} className="text-gray-200 mb-3" />
          <p className="font-semibold text-gray-400 text-sm">No question papers found</p>
          <p className="text-xs text-gray-300 mt-1">Try adjusting your filters or search term</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([subjectName, papers]) => (
            <div key={subjectName} className="space-y-3">
              {/* Subject group header */}
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-[var(--brand)]" />
                <h3 className="text-sm font-bold text-gray-800 truncate">{subjectName}</h3>
                <span className="shrink-0 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {papers.length} paper{papers.length !== 1 ? "s" : ""}
                </span>
              </div>
              {/* Paper cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {papers.map((pyq) => (
                  <div key={pyq._id}
                    className="group relative bg-white rounded-2xl border border-[var(--line)] p-4 shadow-sm hover:shadow-md hover:border-[var(--brand)]/30 transition-all duration-200">
                    {/* Top row: exam badge + year */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${examTypeColors[pyq.examType] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
                        {pyq.examType}
                      </span>
                      <span className="text-xs font-extrabold text-gray-400">{pyq.year}</span>
                    </div>
                    {/* Subject code + name */}
                    <div className="mb-3">
                      {(pyq.title || pyq.subject?.code) && (
                        <span className="text-[9px] font-bold text-[var(--brand)] bg-[var(--brand)]/8 px-2 py-0.5 rounded uppercase tracking-wider mb-1.5 inline-block">
                          {pyq.title || pyq.subject?.code}
                        </span>
                      )}
                      <p className="text-sm font-bold text-gray-800 leading-snug line-clamp-2">{subjectName}</p>
                      {pyq.course?.name && (
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{pyq.course.name}</p>
                      )}
                    </div>
                    {/* Views */}
                    <p className="text-[10px] text-gray-300 font-semibold mb-3">{pyq.views || 0} views</p>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <a
                        href={asset(pyq.fileUrl)}
                        target="_blank"
                        onClick={() => onView?.(pyq._id)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white transition active:scale-95 cursor-pointer"
                        style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
                      >
                        <FileUp size={12} />
                        Open PDF
                      </a>
                      <Link
                        href={`/ai-assistant?pyqId=${pyq._id}`}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border border-[var(--brand)]/20 text-[var(--brand)] bg-[var(--brand)]/5 hover:bg-[var(--brand)]/10 transition active:scale-95"
                      >
                        <Sparkles size={12} />
                        Ask AI
                      </Link>
                      {canManage && (
                        <button
                          onClick={() => remove(`/pyqs/${pyq._id}`)}
                          className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




function UsersPanel({ users, courses, institutes, refresh, token, notify }: { users: User[]; courses: Course[]; institutes: Institute[]; refresh: () => Promise<void>; token: string; notify: (toast: Toast) => void }) {
  const [selectedInstitute, setSelectedInstitute] = useState("");
  const filteredCourses = courses.filter((course) => course.institute?._id === selectedInstitute);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("user"));
    const role = String(form.get("role"));
    const course = courses.find((item) => item._id === String(form.get("course")));
    const adminScopes = role === "admin" && course ? [{ institute: course.institute._id, course: course._id }] : [];
    try {
      await api(`/users/${id}/role`, { token, method: "PATCH", body: { role, adminScopes } });
      await refresh();
      notify({ type: "success", text: "User role updated" });
    } catch (error) {
      notify({ type: "error", text: (error as Error).message });
    }
  }

  return (
    <Panel title="User and Admin Management">
      <FormGrid onSubmit={assign}>
        <Select name="user" label="User" options={users.map((item) => [item._id || item.id || "", `${item.name} - ${item.email}`])} required />
        <Select name="role" label="Role" options={[["user", "User"], ["admin", "Limited Admin"], ["super_admin", "Super Admin"]]} required />
        <Select name="scopeInstitute" label="Institute" value={selectedInstitute} onChange={setSelectedInstitute} options={institutes.map((item) => [item._id, `${item.shortForm} - ${item.name}`])} />
        <Select name="course" label="Assigned Course" options={filteredCourses.map((item) => [item._id, item.name])} disabled={!selectedInstitute} />
        <Submit loading={false} label="Update Role" />
      </FormGrid>
      <DataTable
        title="Users"
        rows={users}
        columns={["Name", "Email", "Role", "Scopes"]}
        render={(item) => [
          item.name,
          item.email,
          item.role.replace("_", " "),
          (item.adminScopes || [])
            .map((scope) => {
              const institute = typeof scope.institute === "string" ? institutes.find((i) => i._id === scope.institute)?.shortForm : scope.institute.shortForm;
              const course = typeof scope.course === "string" ? courses.find((c) => c._id === scope.course)?.name : scope.course.name;
              return `${institute || ""} ${course || ""}`.trim();
            })
            .join(", ") || "-",
        ]}
      />
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function FormGrid({ onSubmit, children }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
      {children}
    </form>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  compact?: boolean;
  onChange?: (value: string) => void;
};

function Input(props: InputProps) {
  const { label, compact, onChange, ...rest } = props;
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[var(--muted)]">{label}</span>
      <input
        {...rest}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={`w-full rounded-lg border border-[var(--line)] bg-white px-3 ${compact ? "py-2" : "py-3"} outline-none focus:border-[var(--brand)]`}
      />
    </label>
  );
}

function Select(props: {
  name: string;
  label: string;
  options: (string | number)[][];
  required?: boolean;
  compact?: boolean;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[var(--muted)]">{props.label}</span>
      <select
        name={props.name}
        required={props.required}
        disabled={props.disabled}
        value={props.value}
        defaultValue={props.defaultValue}
        onChange={props.onChange ? (event) => props.onChange?.(event.target.value) : undefined}
        className={`w-full rounded-lg border border-[var(--line)] bg-white px-3 ${props.compact ? "py-2" : "py-3"} outline-none focus:border-[var(--brand)]`}
      >
        <option value="">Select</option>
        {props.options.map(([value, label]) => (
          <option key={String(value)} value={String(value)}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Submit({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button disabled={loading} className="self-end rounded-lg bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
      {loading ? "Working..." : label}
    </button>
  );
}

function IconDelete({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid h-9 w-9 place-items-center rounded-lg text-red-600 hover:bg-red-50" title="Delete">
      <Trash2 size={17} />
    </button>
  );
}

function IconEdit({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--brand)] hover:bg-[#f7eef3]" title="Edit">
      <Pencil size={17} />
    </button>
  );
}

function RowActions({ edit, remove }: { edit: () => void; remove: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <IconEdit onClick={edit} />
      <IconDelete onClick={remove} />
    </div>
  );
}

function DataTable<T>({ title, rows, columns, render }: { title: string; rows: T[]; columns: string[]; render: (row: T) => React.ReactNode[] }) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm">
      <div className="border-b border-[var(--line)] px-4 py-3 font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#faf7f9] text-[var(--muted)]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-[var(--muted)]" colSpan={columns.length}>No records yet</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="border-t border-[var(--line)]">
                  {render(row).map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-middle">{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OnboardingScreen({
  user,
  setUser,
  institutes,
  courses,
  semesters,
  token,
  loadAll,
  isMandatory,
  onCancel,
  onComplete,
}: {
  user: User;
  setUser: (user: User) => void;
  institutes: Institute[];
  courses: Course[];
  semesters: Semester[];
  token: string;
  loadAll: () => Promise<void>;
  isMandatory: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const [selectedInst, setSelectedInst] = useState(user.institute || "");
  const [selectedCourse, setSelectedCourse] = useState(user.course || "");
  const [selectedSem, setSelectedSem] = useState(user.semester || "");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Filtering
  const filteredInstitutes = institutes.filter(inst =>
    inst.name.toLowerCase().includes(search.toLowerCase()) ||
    inst.shortForm?.toLowerCase().includes(search.toLowerCase())
  );

  const availableCourses = courses.filter(c => {
    const instId = typeof c.institute === "string" ? c.institute : c.institute?._id;
    return instId === selectedInst;
  });

  const availableSemesters = semesters.filter(s => {
    const courseId = typeof s.course === "string" ? s.course : s.course?._id;
    return courseId === selectedCourse;
  });

  async function handleComplete() {
    if (!selectedInst || !selectedCourse || !selectedSem) {
      setError("Please complete all steps first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<{ user: User; message: string }>("/auth/preferences", {
        method: "PUT",
        token,
        body: {
          institute: selectedInst,
          course: selectedCourse,
          semester: selectedSem,
        },
      });
      setUser(data.user);
      await loadAll();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences.");
    } finally {
      setBusy(false);
    }
  }

  const selectedInstData = institutes.find(i => i._id === selectedInst);
  const selectedCourseData = courses.find(c => c._id === selectedCourse);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#7a2854]/15 via-[#f3f4f6] to-[#eca27c]/15 px-4 py-12">
      {/* Decorative Blobs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-[var(--brand)]/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-[var(--soft-accent)]/10 blur-3xl" />

      <div className="relative w-full max-w-3xl rounded-1xl bg-white/70 border border-white/40 backdrop-blur-xl p-6 sm:p-10 shadow-2xl transition duration-500 hover:shadow-[0_20px_50px_rgba(122,40,84,0.1)] animate-in fade-in zoom-in-95 duration-500">

        {/* Close button if not mandatory */}
        {!isMandatory && (
          <button
            onClick={onCancel}
            className="absolute top-6 right-6 text-[var(--muted)] hover:text-[var(--brand)] transition p-2 hover:bg-gray-100/50 rounded-xl cursor-pointer"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--brand-accent)] px-3 py-1 rounded-full bg-[var(--brand)]/10">
            Welcome to RisholviiY
          </span>
          <h2 className="text-3xl font-extrabold mt-3 text-[var(--foreground)] tracking-tight">
            Academic Profile Setup
          </h2>
          <p className="text-sm text-[var(--muted)] mt-2">
            Configure your institute, course, and semester to view personalized PYQs instantly.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-10 max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)] mb-2 px-1">
            <span className={step >= 1 ? "text-[var(--brand)] font-bold transition duration-300" : "transition duration-300"}>Institute</span>
            <span className={step >= 2 ? "text-[var(--brand)] font-bold transition duration-300" : "transition duration-300"}>Course</span>
            <span className={step >= 3 ? "text-[var(--brand)] font-bold transition duration-300" : "transition duration-300"}>Semester</span>
          </div>
          <div className="h-2 w-full bg-gray-200/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Step Contents */}
        <div className="min-h-[320px] flex flex-col justify-between">
          {/* STEP 1: INSTITUTE */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">Select your Institute</h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Pick your university or college from the database.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search institute..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--line)] bg-white outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10 transition"
                  />
                </div>
              </div>

              {filteredInstitutes.length === 0 ? (
                <div className="text-center py-12 text-[var(--muted)] border border-dashed border-[var(--line)] rounded-lg bg-white/40">
                  <Building2 className="mx-auto text-[var(--muted)] opacity-50 mb-3" size={36} />
                  <p className="text-sm font-medium">No institutes found</p>
                  <p className="text-xs mt-1">Try refining your search query.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[280px] overflow-y-auto pr-1">
                  {filteredInstitutes.map((inst) => {
                    const isSelected = selectedInst === inst._id;
                    return (
                      <button
                        key={inst._id}
                        onClick={() => {
                          setSelectedInst(inst._id);
                          setSelectedCourse("");
                          setSelectedSem("");
                        }}
                        className={`flex items-center gap-3 p-4 rounded-lg border text-left bg-white transition duration-300 group hover:shadow-md hover:scale-[1.02] cursor-pointer ${isSelected
                          ? "border-[var(--brand)] bg-[var(--brand)]/[0.02] ring-2 ring-[var(--brand)]/25 font-bold"
                          : "border-[var(--line)] hover:border-[var(--brand)]/50"
                          }`}
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--brand)]/5 font-bold text-[var(--brand)] transition group-hover:bg-[var(--brand)]/10">
                          {inst.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={asset(inst.logoUrl)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            inst.shortForm
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate text-[var(--foreground)] leading-tight">{inst.name}</p>
                          <p className="text-xs text-[var(--muted)] mt-0.5">{inst.shortForm}</p>
                        </div>
                        {isSelected && (
                          <div className="shrink-0 text-[var(--brand)] bg-[var(--brand)]/10 rounded-full p-0.5">
                            <Check size={14} className="stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: COURSE */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6">
                <span className="text-[10px] font-bold text-[var(--brand)] uppercase tracking-wider bg-[var(--brand)]/10 px-2 py-0.5 rounded">
                  {selectedInstData?.shortForm || "Institute"}
                </span>
                <h3 className="text-lg font-bold text-[var(--foreground)] mt-1.5">Choose your Course</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">Select your program or degree under {selectedInstData?.name}.</p>
              </div>

              {availableCourses.length === 0 ? (
                <div className="text-center py-12 text-[var(--muted)] border border-dashed border-[var(--line)] rounded-lg bg-white/40">
                  <GraduationCap className="mx-auto text-[var(--muted)] opacity-50 mb-3" size={36} />
                  <p className="text-sm font-medium">No courses available</p>
                  <p className="text-xs mt-1">There are no courses listed under this institute yet.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 max-h-[280px] overflow-y-auto pr-1">
                  {availableCourses.map((c) => {
                    const isSelected = selectedCourse === c._id;
                    return (
                      <button
                        key={c._id}
                        onClick={() => {
                          setSelectedCourse(c._id);
                          setSelectedSem("");
                        }}
                        className={`flex items-center justify-between p-5 rounded-lg border text-left bg-white transition duration-300 hover:shadow-md hover:scale-[1.01] cursor-pointer ${isSelected
                          ? "border-[var(--brand)] bg-[var(--brand)]/[0.02] ring-2 ring-[var(--brand)]/25 font-bold"
                          : "border-[var(--line)] hover:border-[var(--brand)]/50"
                          }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)]/5 text-[var(--brand)]">
                            <GraduationCap size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-[var(--foreground)] leading-tight">{c.name}</p>
                            <p className="text-xs text-[var(--muted)] mt-1">Academic Degree</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="shrink-0 text-[var(--brand)] bg-[var(--brand)]/10 rounded-full p-0.5">
                            <Check size={14} className="stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: SEMESTER */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6">
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-[10px] font-bold text-[var(--brand)] uppercase tracking-wider bg-[var(--brand)]/10 px-2 py-0.5 rounded">
                    {selectedInstData?.shortForm || "Institute"}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--brand-accent)] uppercase tracking-wider bg-[var(--brand-accent)]/10 px-2 py-0.5 rounded">
                    {selectedCourseData?.name || "Course"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)] mt-2">Select your Current Semester</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">Pick the active semester to sync your dashboard.</p>
              </div>

              {availableSemesters.length === 0 ? (
                <div className="text-center py-12 text-[var(--muted)] border border-dashed border-[var(--line)] rounded-lg bg-white/40">
                  <Layers3 className="mx-auto text-[var(--muted)] opacity-50 mb-3" size={36} />
                  <p className="text-sm font-medium">No semesters listed</p>
                  <p className="text-xs mt-1">There are no semesters configured for this course yet.</p>
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 max-h-[280px] overflow-y-auto pr-1">
                  {availableSemesters.map((s) => {
                    const isSelected = selectedSem === s._id;
                    return (
                      <button
                        key={s._id}
                        onClick={() => setSelectedSem(s._id)}
                        className={`flex flex-col items-center justify-center p-6 rounded-lg border bg-white transition duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer ${isSelected
                          ? "border-[var(--brand)] bg-[var(--brand)]/[0.02] ring-2 ring-[var(--brand)]/25 font-bold"
                          : "border-[var(--line)] hover:border-[var(--brand)]/50"
                          }`}
                      >
                        <span className={`text-2xl font-black mb-1 transition ${isSelected ? "text-[var(--brand)]" : "text-gray-400"}`}>
                          0{s.number || s.name.match(/\d+/)?.[0] || s.name}
                        </span>
                        <span className="font-bold text-xs text-[var(--foreground)] text-center">{s.name}</span>
                        {isSelected && (
                          <div className="mt-2 text-[var(--brand)] bg-[var(--brand)]/10 rounded-full p-0.5">
                            <Check size={12} className="stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-10 pt-6 border-t border-[var(--line)] flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-5 py-3 text-sm font-bold text-[var(--muted)] bg-white hover:bg-gray-50 transition duration-200 cursor-pointer"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                disabled={step === 1 ? !selectedInst : !selectedCourse}
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 rounded-xl bg-[var(--brand)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--brand-dark)] transition duration-200 shadow-md hover:shadow-lg disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                Continue
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                disabled={!selectedSem || busy}
                onClick={handleComplete}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] px-6 py-3 text-sm font-bold text-white hover:brightness-110 transition duration-200 shadow-md hover:shadow-lg disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {busy ? "Finishing..." : "Complete Setup"}
                <Check size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

