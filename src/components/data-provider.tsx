"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Database, Role } from "@/lib/model";
import { apiFetch, apiJson } from "@/lib/client-api";

type Session = { id: string; firstName: string; lastName: string; email: string; role: Role } | null;
type DataContextValue = {
  db: Database;
  loaded: boolean;
  dataError: string;
  examError: string;
  session: Session;
  today: string;
  refreshSession: () => Promise<Session>;
  reloadAdmin: () => Promise<void>;
  reloadExams: () => Promise<void>;
  logout: () => Promise<void>;
};
const DataContext = createContext<DataContextValue | null>(null);
const empty: Database = { classes: [], students: [], teachers: [], exams: [] };

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database>(empty);
  const [session, setSession] = useState<Session>(null);
  const [today, setToday] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dataError, setDataError] = useState("");
  const [examError, setExamError] = useState("");
  const reloadExams = useCallback(async () => {
    try {
      const { exams } = await apiJson<{ exams: Database["exams"] }>("/api/exams");
      setDb(current => ({ ...current, exams }));
      setExamError("");
    } catch (error) { setExamError(error instanceof Error ? error.message : "Não foi possível carregar os simulados."); }
  }, []);
  const reloadAdmin = useCallback(async () => {
    try {
      const [rooms, students, teachers] = await Promise.all([
        apiJson<{ classrooms: Database["classes"] }>("/api/admin/classrooms"),
        apiJson<{ students: { id: string; firstName: string; lastName: string; classroomId: string }[] }>("/api/admin/students"),
        apiJson<{ teachers: Database["teachers"] }>("/api/admin/teachers"),
      ]);
      setDb(current => ({ ...current, classes: rooms.classrooms, students: students.students.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, classId: s.classroomId })), teachers: teachers.teachers }));
      setDataError("");
    } catch (error) { setDataError(error instanceof Error ? error.message : "Não foi possível carregar os dados."); }
  }, []);
  const refreshSession = useCallback(async () => {
    const result = await apiFetch("/api/auth/me");
    if (!result.ok) { setSession(null); return null; }
    const { user } = await result.json();
    const next: Session = { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role === "COORDENACAO" ? "coordenacao" : "professor" };
    setSession(next);
    await Promise.all([reloadExams(), ...(next.role === "coordenacao" ? [reloadAdmin()] : [])]);
    return next;
  }, [reloadAdmin, reloadExams]);
  const logout = useCallback(async () => {
    const result = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { Origin: location.origin } });
    if (!result.ok) throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
    setSession(null);
    setDb(empty);
  }, []);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setToday(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
    refreshSession().finally(() => setLoaded(true));
    const onVisible = () => { if (document.visibilityState === "visible") refreshSession(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 14 * 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.clearInterval(timer); };
  }, [refreshSession]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return <DataContext.Provider value={{ db, loaded, dataError, examError, session, today, refreshSession, reloadAdmin, reloadExams, logout }}>{children}</DataContext.Provider>;
}
export function useData() { const context = useContext(DataContext); if (!context) throw new Error("DataProvider ausente"); return context; }
