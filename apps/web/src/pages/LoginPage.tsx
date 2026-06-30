import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, LayoutDashboard, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { authService } from "../services/authService";
import type { AuthUser } from "../types";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
  remember: z.boolean().optional()
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "rogerio@pmo.local",
      password: "123456",
      remember: true
    }
  });

  async function submit(values: LoginValues) {
    try {
      setLoading(true);
      const response = await authService.login(values.email, values.password);
      onLogin(response.user);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-[34rem] flex-col justify-between bg-gradient-to-br from-violet-50 via-white to-blue-50 p-10 md:flex">
          <div>
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-brand text-white shadow-lg shadow-brand/20">
              <LayoutDashboard className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-ink">PMO Board</h1>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted">Gestão de atividades e projetos.</p>
          </div>

          <div className="rounded-lg border border-white bg-white/80 p-4 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["Backlog", "A Fazer", "Andamento"].map((label, index) => (
                <div key={label} className="rounded-md bg-slate-50 p-2">
                  <div className="mb-2 h-2 w-16 rounded bg-slate-200" />
                  <div
                    className={`h-7 rounded-md ${
                      index === 0 ? "bg-amber-100" : index === 1 ? "bg-emerald-100" : "bg-blue-100"
                    }`}
                  />
                  <div className="mt-2 h-6 rounded-md bg-white" />
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm font-medium text-muted">Planeje. Execute. Entregue.</p>
        </div>

        <form onSubmit={handleSubmit(submit)} className="flex min-h-[34rem] flex-col justify-center p-6 sm:p-10">
          <div className="mb-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-50 text-brand md:hidden">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-ink">Bem-vindo de volta!</h2>
            <p className="mt-2 text-sm text-muted">Faça login para continuar.</p>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-ink">E-mail</span>
            <input
              {...register("email")}
              type="email"
              className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="seu@email.com"
            />
            {errors.email ? <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span> : null}
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-ink">Senha</span>
            <span className="relative mt-2 block">
              <input
                {...register("password")}
                type="password"
                className="h-11 w-full rounded-md border border-line px-3 pr-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                placeholder="••••••••"
              />
              <Eye className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </span>
            {errors.password ? (
              <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>
            ) : null}
          </label>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <label className="inline-flex items-center gap-2 text-muted">
              <input type="checkbox" {...register("remember")} className="rounded border-line text-brand focus:ring-brand" />
              Lembrar de mim
            </label>
            <button type="button" className="font-semibold text-brand hover:text-violet-700">
              Esqueci minha senha
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </button>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            ou
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-slate-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Entrar com SSO
          </button>
        </form>
      </section>
    </main>
  );
}
