"use client";

import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Loader2,
  LogOut,
  Send,
  Sparkles,
  Trash2,
  Lightbulb,
  TrendingUp,
  Copy,
  Check,
  ArrowUp,
  ChevronDown,
  Menu,
  Mic,
  Plus,
  SquarePen,
  Building2,
  GraduationCap,
  Layers3,
  FileUp,
  Users,
  X,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { api, asset, API_URL } from "@/lib/api";

const nav = [
  { id: "overview", label: "Overview", icon: ShieldCheck },
  { id: "institutes", label: "Institutes", icon: Building2, superOnly: true },
  { id: "courses", label: "Courses", icon: GraduationCap, superOnly: true },
  { id: "semesters", label: "Semesters", icon: Layers3, superOnly: true },
  { id: "subjects", label: "Subjects", icon: BookOpen, superOnly: true },
  { id: "pyqs", label: "PYQs", icon: FileUp },
  { id: "ai-assistant", label: "AI Assistant", icon: Sparkles, href: "/ai-assistant" },
  { id: "users", label: "Users", icon: Users, superOnly: true },
];


type Ref = { _id: string; name: string; shortForm?: string; code?: string; number?: number };

type User = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "user";
  adminScopes?: any[];
  institute?: string;
  course?: string;
  semester?: string;
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
};

type ChatMessage = {
  role: "user" | "ai";
  content: string;
  isLowWarning?: boolean;
  isExhaustedWarning?: boolean;
  questionToAsk?: string;
  sharedPool?: number;
};

const DEFAULT_QUESTION =
  "Analyze this exam paper and explain important topics, key patterns, and study tips to improve marks.";

export default function AiAssistantClient({ initialPyqId }: { initialPyqId: string }) {
  const router = useRouter();
  const [token] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("pyq_token") || ""
  );
  const [user, setUser] = useState<User | null>(null);
  const [pyqs, setPyqs] = useState<Pyq[]>([]);
  const [selectedPyqId, setSelectedPyqId] = useState(initialPyqId);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [loadingPage, setLoadingPage] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => !initialPyqId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [tokenStatus, setTokenStatus] = useState<{
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    zone: "safe" | "notice" | "low" | "exhausted";
    tokensBorrowedToday: number;
    sharedPool: number;
    isThrottled: boolean;
    cycleUsed?: number;
    cycleLimit?: number;
    cycleRemaining?: number;
    nextCycleReset?: string;
    cycleChatsCompleted?: number;
  } | null>(null);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("auto");

  const showSidebar = sidebarOpen;
  const isSuper = user?.role === "super_admin";
  const visibleNav = nav.filter((item) => !item.superOnly || isSuper);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, aiLoading]);

  const fetchTokenStatus = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<{
        used: number;
        limit: number;
        remaining: number;
        percentage: number;
        zone: "safe" | "notice" | "low" | "exhausted";
        tokensBorrowedToday: number;
        sharedPool: number;
        isThrottled: boolean;
        cycleUsed?: number;
        cycleLimit?: number;
        cycleRemaining?: number;
        nextCycleReset?: string;
        cycleChatsCompleted?: number;
      }>("/users/token-status", { token });
      setTokenStatus(data);
    } catch (err) {
      console.error("Failed to load credits status:", err);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      router.replace("/");
      return;
    }

    async function loadAssistantData() {
      try {
        const [meData, pyqData] = await Promise.all([
          api<{ user: User }>("/auth/me", { token }),
          api<{ pyqs: Pyq[] }>("/pyqs", { token }),
        ]);
        if (cancelled) return;
        setUser(meData.user);
        setPyqs(pyqData.pyqs);
        fetchTokenStatus();
      } catch (loadError) {
        if (cancelled) return;
        localStorage.removeItem("pyq_token");
        setError(loadError instanceof Error ? loadError.message : "Unable to load AI Assistant");
        router.replace("/");
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    }

    loadAssistantData();

    return () => {
      cancelled = true;
    };
  }, [router, token, fetchTokenStatus]);

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
    if (!token || !selectedPyqId) {
      setChatHistory([]);
      return;
    }

    async function loadChatHistory() {
      try {
        const data = await api<{ messages: ChatMessage[] }>(`/chats/${selectedPyqId}`, { token });
        setChatHistory(data.messages || []);
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    }

    loadChatHistory();
  }, [selectedPyqId, token]);

  const selectedPyq = useMemo(
    () => pyqs.find((pyq) => pyq._id === selectedPyqId),
    [pyqs, selectedPyqId]
  );

  const pyqOptions = useMemo(
    () =>
      pyqs.map((pyq) => ({
        id: pyq._id,
        label: `${pyq.subject?.code ? `${pyq.subject.code} - ` : ""}${pyq.subject?.name || pyq.title} (${pyq.year}, ${pyq.examType})`,
      })),
    [pyqs]
  );

  function resetConversation() {
    setChatHistory([]);
    setCurrentQuestion("");
    setError("");
  }

  async function clearChat() {
    if (!window.confirm("Are you sure you want to clear this conversation?")) return;
    setChatHistory([]);
    setCurrentQuestion("");
    setError("");
    if (token && selectedPyqId) {
      try {
        await api(`/chats/${selectedPyqId}`, { token, method: "DELETE" });
      } catch (err) {
        console.error("Failed to clear chat history:", err);
      }
    }
  }

  function selectPyq(value: string) {
    setSelectedPyqId(value);
    resetConversation();
    setSidebarOpen(false);
    router.replace(value ? `/ai-assistant?pyqId=${value}` : "/ai-assistant", { scroll: false });
  }

  function signOut() {
    localStorage.removeItem("pyq_token");
    router.replace("/");
  }

  async function markViewed(pyqId: string) {
    try {
      await api(`/pyqs/${pyqId}/view`, { token, method: "POST" });
      setPyqs((current) =>
        current.map((pyq) =>
          pyq._id === pyqId ? { ...pyq, views: (pyq.views || 0) + 1 } : pyq
        )
      );
    } catch {
      // Opening the PDF should not be blocked by view-count bookkeeping.
    }
  }

  async function handleBorrowCredits() {
    if (!token || borrowLoading) return;
    setBorrowLoading(true);
    setError("");
    try {
      const data = await api<{ message: string; tokensBorrowedToday: number; limit: number }>("/users/borrow", {
        token,
        method: "POST",
      });
      await fetchTokenStatus();
      setChatHistory((current) => [
        ...current,
        { role: "ai", content: `🎉 **Credits Borrowed!**\n\n${data.message}\nYour limit has been increased to **${data.limit} credits**.` }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to borrow credits");
    } finally {
      setBorrowLoading(false);
    }
  }

  async function handleBorrowAndProceed(question: string) {
    if (!token || borrowLoading) return;
    setBorrowLoading(true);
    setError("");
    try {
      const data = await api<{ message: string; tokensBorrowedToday: number; limit: number }>("/users/borrow", {
        token,
        method: "POST",
      });
      await fetchTokenStatus();
      setChatHistory((current) => [
        ...current.filter((m) => !m.isLowWarning && !m.isExhaustedWarning),
        { role: "ai", content: `🎉 **Borrowed & Continuing:**\n\n${data.message}\nYour limit is now **${data.limit} credits**.` }
      ]);
      setBorrowLoading(false);
      await askAi(question, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to borrow credits");
      setBorrowLoading(false);
    }
  }

  async function handleConfirmLow(question: string) {
    setChatHistory((current) => current.filter((m) => !m.isLowWarning && !m.isExhaustedWarning));
    await askAi(question, true);
  }

  async function askAi(question?: string, confirmLow = false) {
    const questionToAsk = (question || currentQuestion || DEFAULT_QUESTION).trim();
    if (!questionToAsk || !selectedPyqId || aiLoading) return;

    const previousHistory = chatHistory;
    if (!confirmLow) {
      setChatHistory((current) => [...current, { role: "user", content: questionToAsk }]);
      setCurrentQuestion("");
    }
    setError("");
    setAiLoading(true);

    try {
      const response = await fetch(`${API_URL}/pyqs/${selectedPyqId}/ask-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: questionToAsk,
          conversationHistory: previousHistory.filter((m) => !m.isLowWarning && !m.isExhaustedWarning),
          confirmLowQuota: confirmLow,
          selectedModel,
        })
      });

      const data = await response.json();

      if (response.status === 202 && data.code === "LOW_QUOTA_WARNING") {
        setChatHistory((current) => [
          ...current,
          {
            role: "ai",
            content: `⚠️ **Quota Status: Low Credits**\n\nYou have **${data.remainingTokens} credits** left. Would you like to proceed anyway, or borrow 200 credits from the shared pool?\n\n*Remaining Shared Pool: ${data.sharedPool} credits*`,
            isLowWarning: true,
            questionToAsk: questionToAsk,
            sharedPool: data.sharedPool
          }
        ]);
      } else if (response.status === 402 && data.code === "QUOTA_EXHAUSTED") {
        setChatHistory((current) => [
          ...current,
          {
            role: "ai",
            content: `⚠️ **Quota Exhausted**\n\nYour daily quota is used up. The shared pool has **${data.sharedPool} credits**.\n\n${data.sharedPool > 0 ? "You can borrow 200 credits to continue immediately." : "Unfortunately, the shared pool is also empty today. Please come back tomorrow when your quota resets."}`,
            isExhaustedWarning: true,
            sharedPool: data.sharedPool
          }
        ]);
      } else if (!response.ok) {
        throw new Error(data.message || "Failed to get an AI response");
      } else {
        const routerNote = data.routerDecision
          ? `🧠 *Smart Router → **${data.routerDecision.selected_model}** — ${data.routerDecision.reasoning}*\n\n---\n\n`
          : "";
        setChatHistory((current) => [...current, { role: "ai", content: routerNote + data.insight }]);
      }

      fetchTokenStatus();
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "Failed to get an AI response");
    } finally {
      setAiLoading(false);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    askAi();
  }

  if (loadingPage) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4 text-[var(--foreground)]">
        <div className="flex items-center gap-3 rounded-lg bg-white px-5 py-4 text-sm font-semibold shadow-sm">
          <Loader2 className="animate-spin text-[var(--brand)]" size={18} />
          Loading AI Assistant
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      {/* Mobile Top Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-white px-4 py-3 lg:hidden shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition active:scale-95 cursor-pointer shrink-0"
            title="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-bold text-[var(--brand)] truncate">RisholviiY</span>
            <span className="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--brand)] capitalize shrink-0">
              {user?.role.replace("_", " ")}
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
              <p className="text-xs text-[#707070] capitalize truncate">{user?.role.replace("_", " ")}</p>
              {user?.role === "admin" && user.adminScopes && user.adminScopes.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 max-w-[180px]">
                  {user.adminScopes.map((scope: any, idx: number) => {
                    const inst = scope.institute;
                    const course = scope.course;
                    const instName = typeof inst === "string" ? inst : inst?.shortForm || inst?.name || "Unknown";
                    const courseName = typeof course === "string" ? course : course?.name || "Unknown";
                    return (
                      <span key={idx} className="text-[10px] text-[var(--muted)] font-medium truncate" title={`${instName} - ${courseName}`}>
                        {instName} ({courseName})
                      </span>
                    );
                  })}
                </div>
              )}
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
            const selected = item.id === "ai-assistant";
            const className = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition w-full ${selected
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--muted)] hover:bg-[#f7eef3] hover:text-[var(--brand)]"
              }`;

            const handleClick = () => {
              setMobileMenuOpen(false);
            };

            const href = item.id === "ai-assistant" ? "/ai-assistant" : `/?tab=${item.id}`;
            return (
              <Link key={item.id} href={href} className={className} onClick={handleClick}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <button
            onClick={() => {
              localStorage.removeItem("pyq_token");
              signOut();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--brand)] cursor-pointer"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex min-h-0 flex-col lg:flex-row overflow-hidden">
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
                {user?.role.replace("_", " ")}
              </p>
              {user?.role === "admin" && user.adminScopes && user.adminScopes.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 max-w-[200px]">
                  {user.adminScopes.map((scope: any, idx: number) => {
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
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const selected = item.id === "ai-assistant";
              const className = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition w-full ${selected ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:bg-[#f7eef3] hover:text-[var(--brand)]"
                }`;
              const href = item.id === "ai-assistant" ? "/ai-assistant" : `/?tab=${item.id}`;
              return (
                <Link key={item.id} href={href} className={className}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-5 py-4">
            <button
              onClick={() => {
                localStorage.removeItem("pyq_token");
                signOut();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--brand)] cursor-pointer"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 p-3 sm:p-5 lg:p-8 overflow-hidden flex flex-col min-h-screen lg:min-h-0">

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <section className={`flex-1 gap-4 w-full ${showSidebar ? "grid lg:grid-cols-[320px_minmax(0,1fr)]" : "flex"}`}>

            {/* ===== SIDEBAR ===== */}
            <aside className={`
              space-y-3 shrink-0
              ${showSidebar ? "block w-full lg:w-[320px]" : "hidden"}
            `}>

              {/* PYQ Selector Card */}
              <div className="rounded-xl bg-white p-4 shadow-sm border border-[var(--line)]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <BookOpen size={15} />
                    Choose PYQ
                  </div>
                  {selectedPyqId && (
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="rounded-lg bg-[var(--brand)]/10 px-2.5 py-1 text-xs font-bold text-[var(--brand)] hover:bg-[var(--brand)]/15 lg:hidden active:scale-95 transition cursor-pointer"
                    >
                      Back to Chat
                    </button>
                  )}
                </div>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-[var(--muted)] text-xs uppercase tracking-wide">Question Paper</span>
                  <select
                    value={selectedPyqId}
                    onChange={(e) => selectPyq(e.target.value)}
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] transition"
                  >
                    <option value="">Select a paper...</option>
                    {pyqOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* PYQ Info Card */}
              {selectedPyq && (
                <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm">
                  <p className="text-sm font-bold text-[var(--foreground)] leading-snug">
                    {selectedPyq.subject?.name || selectedPyq.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {selectedPyq.course?.name} / {selectedPyq.semester?.name}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <InfoTile label="Exam" value={selectedPyq.examType} />
                    <InfoTile label="Year" value={String(selectedPyq.year)} />
                    <InfoTile label="Views" value={String(selectedPyq.views || 0)} />
                    <InfoTile label="Code" value={selectedPyq.title || "-"} />
                  </div>
                  <a
                    href={asset(selectedPyq.fileUrl)}
                    target="_blank"
                    onClick={() => markViewed(selectedPyq._id)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-3 py-2.5 text-sm font-semibold text-[var(--brand)] transition hover:bg-[var(--brand)]/10 active:scale-[0.99]"
                  >
                    <ExternalLink size={15} />
                    Open PDF
                  </a>
                </div>
              )}
            </aside>

            {/* ===== CHAT SECTION ===== */}
            <section className={`
      flex flex-col overflow-hidden rounded-xl bg-white shadow-sm
      h-[calc(100dvh-110px)] sm:h-[calc(100dvh-130px)] lg:h-[calc(100vh-160px)]
      ${!showSidebar ? "flex" : "hidden lg:flex"}
    `}>

              {/* Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5 bg-white">

                {/* Mobile sidebar toggle + AI Engine */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mobile: Show sidebar toggle */}
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden flex items-center justify-center h-7 w-7 rounded-lg border border-[var(--line)] text-gray-500 hover:bg-gray-50 shrink-0 transition active:scale-95"
                  >
                    <BookOpen size={13} />
                  </button>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI Engine</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5 outline-none cursor-pointer focus:border-[var(--brand)] focus:bg-white transition max-w-[160px] xs:max-w-[200px] sm:max-w-none"
                      >
                        <option value="auto">⚡ Auto (Smart Router)</option>
                        <option value="groq">Llama 3.3 (Groq)</option>
                        <option value="gemini:gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini:gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini:gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini:aqa">Gemini AQA</option>
                        <option value="openrouter:meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 Free (OR)</option>
                        <option value="openrouter:mistralai/mistral-7b-instruct:free">Mistral 7B Free (OR)</option>
                        <option value="openrouter:google/gemma-2-9b-it:free">Gemma 2 9B Free (OR)</option>
                        <option value="openrouter:qwen/qwen3-8b:free">Qwen 3 8B Free (OR)</option>
                      </select>
                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    </div>
                  </div>
                </div>

                {/* Active PYQ badge */}
                {selectedPyqId && selectedPyq && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-medium text-[var(--muted)] hidden sm:inline shrink-0">Active:</span>
                    <span className="rounded-full bg-[var(--brand)]/8 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-[var(--brand)] truncate max-w-[120px] sm:max-w-[200px]">
                      {selectedPyq.subject?.name || selectedPyq.title} ({selectedPyq.year})
                    </span>
                    <button
                      onClick={clearChat}
                      title="Clear chat history from database"
                      className="p-1 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition cursor-pointer active:scale-95 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto bg-[#fbfafc] p-3 sm:p-5">
                {!selectedPyq && (
                  <EmptyState
                    title="No PYQ selected"
                    text="Choose a question paper from the panel to begin analysis."
                  />
                )}

                {selectedPyq && chatHistory.length === 0 && !aiLoading && (
                  <div className="flex flex-col items-center justify-center min-h-full py-6 text-center max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="mb-4 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-lg bg-gradient-to-tr from-[var(--brand)] to-[var(--brand-dark)] text-white shadow-md">
                      <Sparkles size={22} className="animate-pulse" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-800">
                      Interact with your exam paper
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-[var(--muted)] max-w-sm">
                      Analyze topics, spot recurring patterns, and get study advice based on this PYQ.
                    </p>

                    <div className="mt-6 w-full space-y-3">
                      <button
                        onClick={() => askAi(DEFAULT_QUESTION)}
                        disabled={aiLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-[var(--brand-dark)] active:scale-[0.99] transition cursor-pointer"
                      >
                        <Sparkles size={15} />
                        ⚡ Run Full Paper Analysis
                      </button>

                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-200" />
                        <span className="flex-shrink mx-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-[#fbfafc] px-2">
                          Or ask specific questions
                        </span>
                        <div className="flex-grow border-t border-gray-200" />
                      </div>

                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 text-left">
                        {[
                          { emoji: "📝", label: "Identify high-weightage topics", q: "What are the most frequent long-answer questions or concepts in this paper?" },
                          { emoji: "🧠", label: "Summarize core concepts", q: "Summarize the main formulas, theories, or key definitions required for this exam." },
                          { emoji: "⏱️", label: "Get a time management strategy", q: "Suggest a time management plan and step-by-step strategy to complete this exam on time." },
                          { emoji: "✍️", label: "Generate mock practice questions", q: "Generate 3 practice questions or variations of the numerical problems in this paper." },
                        ].map(({ emoji, label, q }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => askAi(q)}
                            className="p-3 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-[var(--brand)] hover:text-[var(--brand)] transition text-left active:scale-[0.98] cursor-pointer shadow-sm flex items-center gap-2"
                          >
                            <span>{emoji}</span> {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {chatHistory.map((message, index) => (
                  <ChatBubble
                    key={`${message.role}-${index}`}
                    message={message}
                    userInitials={user?.name?.slice(0, 1).toUpperCase() || "U"}
                    onConfirmLow={handleConfirmLow}
                    onBorrowAndProceed={handleBorrowAndProceed}
                    onBorrow={handleBorrowCredits}
                  />
                ))}

                {aiLoading && (
                  <div className="flex max-w-full items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-4 py-3.5 text-xs text-[var(--muted)] shadow-sm animate-pulse">
                    <Loader2 className="animate-spin text-[var(--brand)] shrink-0" size={15} />
                    Analyzing exam paper details...
                  </div>
                )}

                {chatHistory.length > 0 && !aiLoading && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quick Follow-ups</p>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 text-left">
                      {[
                        { emoji: "📝", label: "High-weightage topics", q: "What are the most frequent long-answer questions or concepts in this paper?" },
                        { emoji: "🧠", label: "Summarize core concepts", q: "Summarize the main formulas, theories, or key definitions required for this exam." },
                        { emoji: "⏱️", label: "Time management strategy", q: "Suggest a time management plan and step-by-step strategy to complete this exam on time." },
                        { emoji: "✍️", label: "Mock practice questions", q: "Generate 3 practice questions or variations of the numerical problems in this paper." },
                      ].map(({ emoji, label, q }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => askAi(q)}
                          className="p-3 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-[var(--brand)] hover:text-[var(--brand)] transition text-left active:scale-[0.98] cursor-pointer shadow-sm flex items-center gap-2"
                        >
                          <span>{emoji}</span> {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center pt-1 flex items-center justify-center gap-1">
                      <span>👇</span> Ask your own question below
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <div className="sticky bottom-0 z-10 border-t border-[var(--line)] bg-white p-3 sm:p-4">
                <form onSubmit={submitQuestion}>
                  <div className="relative flex items-center rounded-full border border-gray-200 bg-gray-50/60 px-3 py-1.5 gap-2 focus-within:bg-white focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand)]/10 transition-all shadow-sm">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      placeholder={selectedPyq ? "Ask anything about this paper..." : "Select a PYQ to start..."}
                      disabled={!selectedPyq || aiLoading}
                      className="flex-1 bg-transparent px-1 py-1.5 text-sm outline-none text-gray-800 placeholder-gray-400 disabled:cursor-not-allowed min-w-0"
                    />
                    <button
                      type="submit"
                      disabled={!selectedPyq || aiLoading || !currentQuestion.trim()}
                      className="h-8 w-8 rounded-full bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
                    >
                      {aiLoading
                        ? <Loader2 className="animate-spin" size={13} />
                        : <ArrowUp size={14} strokeWidth={2.5} />
                      }
                    </button>
                  </div>
                </form>
              </div>

            </section>
          </section>
        </div>
      </div>
    </main >
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#faf7f9] p-3">
      <p className="text-[11px] font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid h-full min-h-[360px] place-items-center text-center">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-[var(--brand)]/8 text-[var(--brand)]">
          <Sparkles size={22} />
        </div>
        <p className="font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
      </div>
    </div>
  );
}

interface ParsedItem {
  boldText?: string;
  normalText: string;
}

interface ParsedSection {
  title: string;
  items: ParsedItem[];
  paragraphs: string[];
}

function FormattedAiResponse({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const [cleanContent, warningText] = useMemo(() => {
    const parts = content.split(/\[QUOTA_WARNING\]([\s\S]*?)\[\/QUOTA_WARNING\]/);
    if (parts.length > 1) {
      return [parts[0].trim(), parts[1].trim()];
    }
    return [content, null];
  }, [content]);

  const sections = useMemo(() => {
    const lines = cleanContent.split("\n");
    const result: ParsedSection[] = [];
    let currentSection: ParsedSection = {
      title: "",
      items: [],
      paragraphs: [],
    };

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Header check: starts with #, or starts and ends with **, or ends with : and is short
      const isHeader =
        trimmed.startsWith("#") ||
        (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length < 80) ||
        (trimmed.endsWith(":") &&
          !trimmed.startsWith("-") &&
          !trimmed.startsWith("*") &&
          !/^\d+\./.test(trimmed) &&
          trimmed.length < 60);

      if (isHeader) {
        if (
          currentSection.title ||
          currentSection.items.length > 0 ||
          currentSection.paragraphs.length > 0
        ) {
          result.push(currentSection);
        }

        let title = trimmed
          .replace(/^#+\s*/, "")
          .replace(/^\*+\s*/, "")
          .replace(/\*+$/, "")
          .replace(/:$/, "");

        currentSection = {
          title: title.trim(),
          items: [],
          paragraphs: [],
        };
      } else if (trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\.\s+/.test(trimmed)) {
        let itemText = trimmed.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "");

        const boldMatch = itemText.match(/^\*\*(.*?)\*\*[:\s]*(.*)$/);
        if (boldMatch) {
          currentSection.items.push({
            boldText: boldMatch[1].trim(),
            normalText: boldMatch[2].trim(),
          });
        } else {
          currentSection.items.push({
            normalText: itemText.trim(),
          });
        }
      } else {
        currentSection.paragraphs.push(trimmed);
      }
    }

    if (
      currentSection.title ||
      currentSection.items.length > 0 ||
      currentSection.paragraphs.length > 0
    ) {
      result.push(currentSection);
    }

    return result;
  }, [cleanContent]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const renderTextWithBold = (text: string) => {
    if (!text) return null;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <strong key={index} className="font-extrabold text-gray-900">
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  const getHeaderEmoji = (title: string) => {
    if (/^[\u{1F300}-\u{1F9FF}]|^[\u{2700}-\u{27BF}]/u.test(title)) {
      return "";
    }
    const t = title.toLowerCase();
    if (t.includes("free") || t.includes("kya") || t.includes("cost") || t.includes("rupee") || t.includes("price")) return "💰";
    if (t.includes("best") || t.includes("important") || t.includes("part") || t.includes("top") || t.includes("trend")) return "🚀";
    if (t.includes("lekin") || t.includes("but") || t.includes("limit") || t.includes("warning")) return "👉";
    return "👉";
  };

  return (
    <div className="space-y-4 text-gray-800 antialiased leading-relaxed">
      <div className="flex items-center justify-between border-b border-gray-150 pb-2 mb-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">
          <span className="flex h-1.5 w-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
          Response
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-500 shadow-sm transition hover:bg-gray-50 active:scale-95 cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={10} className="text-emerald-600" />
              <span className="text-emerald-600">Copied</span>
            </>
          ) : (
            <>
              <Copy size={10} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-4">
        {sections.map((section, sIdx) => {
          const emoji = getHeaderEmoji(section.title);

          return (
            <div key={sIdx} className="space-y-2.5">
              {sIdx > 0 && <hr className="border-gray-200/80 my-4" />}

              {section.title && (
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  {emoji && <span className="text-base">{emoji}</span>}
                  <span>{section.title}</span>
                </h3>
              )}

              <div className="space-y-2">
                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="text-xs text-gray-700 leading-relaxed font-normal">
                    {renderTextWithBold(p)}
                  </p>
                ))}

                {section.items.length > 0 && (
                  <ul className="space-y-2 pl-1.5">
                    {section.items.map((item, iIdx) => {
                      const text = item.normalText || "";
                      const hasLeadingEmoji = /^[^\w\s\d]/.test(text) || (item.boldText && /^[^\w\s\d]/.test(item.boldText));

                      const startsWithCheck = text.startsWith("✔️") || text.startsWith("✅");
                      const startsWithCross = text.startsWith("❌");

                      return (
                        <li key={iIdx} className="flex items-start gap-2 text-xs text-gray-700">
                          {!startsWithCheck && !startsWithCross && !hasLeadingEmoji && (
                            <span className="text-gray-400 mt-1.5 shrink-0 block h-1 w-1 rounded-full bg-gray-400" />
                          )}
                          <div className="leading-relaxed flex-1">
                            {item.boldText && (
                              <span className="mr-1 inline-block font-bold text-gray-950">
                                {item.boldText}
                              </span>
                            )}
                            <span className="font-normal text-gray-700">
                              {renderTextWithBold(item.normalText)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {warningText && (
        <div className="mt-4 rounded-xl bg-indigo-50/60 border border-indigo-100 p-3.5 flex items-start gap-2 text-xs text-indigo-900 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
          <div className="font-semibold whitespace-pre-line leading-relaxed">
            {warningText}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatBubble({
  message,
  userInitials,
  onConfirmLow,
  onBorrowAndProceed,
  onBorrow,
}: {
  message: ChatMessage;
  userInitials: string;
  onConfirmLow?: (question: string) => void;
  onBorrowAndProceed?: (question: string) => void;
  onBorrow?: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} w-full gap-2.5 items-end`}>

      <div
        className={`max-w-[100%] rounded-lg px-4 py-3.5 text-sm leading-relaxed ${isUser
          ? "bg-gradient-to-tr from-[var(--brand)] to-[var(--brand-dark)] text-white shadow-sm rounded-br-none font-medium"
          : "border border-gray-100 bg-white text-gray-800 shadow-sm w-full rounded-bl-none"
          }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <FormattedAiResponse content={message.content} />

            {message.isLowWarning && onConfirmLow && onBorrowAndProceed && (
              <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-gray-105">
                <button
                  onClick={() => onConfirmLow(message.questionToAsk || "")}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-xs font-bold cursor-pointer"
                >
                  Proceed Anyway
                </button>
                {(message.sharedPool || 0) > 0 && (
                  <button
                    onClick={() => onBorrowAndProceed(message.questionToAsk || "")}
                    className="px-3 py-1.5 rounded-lg bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] transition text-xs font-bold cursor-pointer"
                  >
                    Borrow 200 Credits & Proceed
                  </button>
                )}
              </div>
            )}

            {message.isExhaustedWarning && onBorrow && (message.sharedPool || 0) > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-gray-105">
                <button
                  onClick={onBorrow}
                  className="px-3 py-1.5 rounded-lg bg-[#A83D63] text-white hover:bg-[#833856] transition text-xs font-bold cursor-pointer"
                >
                  Borrow 200 Credits
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
