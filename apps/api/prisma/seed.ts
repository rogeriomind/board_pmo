import { ActivityStatus, PrismaClient, Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const tagColors: Record<string, string> = {
  Automacao: "#6d5dfc",
  WhatsApp: "#10b981",
  Comunicacao: "#0ea5e9",
  Financeiro: "#f59e0b",
  Dados: "#ef4444",
  UX: "#8b5cf6",
  Seguranca: "#14b8a6"
};

async function main() {
  const existingUsers = await prisma.user.count();

  if (existingUsers > 0) {
    console.log("Seed skipped: database already has users.");
    return;
  }

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? "123456";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const users = await Promise.all(
    [
      ["Rogerio", "rogerio@pmo.local", "https://api.dicebear.com/9.x/avataaars/svg?seed=Rogerio"],
      ["Ana", "ana@pmo.local", "https://api.dicebear.com/9.x/avataaars/svg?seed=Ana"],
      ["Matheus", "matheus@pmo.local", "https://api.dicebear.com/9.x/avataaars/svg?seed=Matheus"],
      ["Gabrielle", "gabrielle@pmo.local", "https://api.dicebear.com/9.x/avataaars/svg?seed=Gabrielle"]
    ].map(([name, email, avatarUrl]) =>
      prisma.user.create({
        data: { name, email, avatarUrl, passwordHash }
      })
    )
  );

  const [rogerio, ana, matheus, gabrielle] = users;

  await Promise.all(
    Object.entries(tagColors).map(([name, color]) =>
      prisma.tag.upsert({
        where: { name },
        update: { color },
        create: { name, color }
      })
    )
  );

  async function getTags(names: string[]) {
    return prisma.tag.findMany({ where: { name: { in: names } } });
  }

  async function createActivity(input: {
    title: string;
    description: string;
    status: ActivityStatus;
    priority: Priority;
    assigneeId: string;
    dueDate: string;
    tags: string[];
    checklist: Array<{ title: string; isDone: boolean }>;
    blockedReason?: string;
    completedAt?: string;
  }) {
    const tags = await getTags(input.tags);
    const activity = await prisma.activity.create({
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        dueDate: new Date(`${input.dueDate}T12:00:00.000Z`),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        blockedReason: input.blockedReason,
        createdById: rogerio.id,
        tags: {
          create: tags.map((tag) => ({ tagId: tag.id }))
        },
        checklistItems: {
          create: input.checklist
        },
        history: {
          create: {
            userId: rogerio.id,
            action: "Atividade criada"
          }
        }
      }
    });

    return activity;
  }

  const activities = await Promise.all([
    createActivity({
      title: "Configurar lembrete automatico",
      description: "Configurar lembrete automatico de atualizacao de atividades via WhatsApp e e-mail.",
      status: ActivityStatus.TODO,
      priority: Priority.HIGH,
      assigneeId: rogerio.id,
      dueDate: "2026-07-10",
      tags: ["Automacao", "WhatsApp", "Comunicacao"],
      checklist: [
        { title: "Mapear fluxo atual", isDone: true },
        { title: "Definir regras de lembrete", isDone: true },
        { title: "Configurar templates de mensagem", isDone: false },
        { title: "Testes e validacao", isDone: false }
      ]
    }),
    createActivity({
      title: "Desenvolver modulo de cobranca",
      description: "Entregar rotina de cobranca com retentativas e trilha de auditoria.",
      status: ActivityStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      assigneeId: ana.id,
      dueDate: "2026-07-03",
      tags: ["Financeiro", "Automacao"],
      checklist: [
        { title: "Modelar eventos de cobranca", isDone: true },
        { title: "Implementar endpoint de retentativa", isDone: false },
        { title: "Criar painel de acompanhamento", isDone: false }
      ]
    }),
    createActivity({
      title: "Encontro de dados com CRM",
      description: "Validar contrato de integracao com CRM e alinhar dependencia externa.",
      status: ActivityStatus.BLOCKED,
      priority: Priority.HIGH,
      assigneeId: matheus.id,
      dueDate: "2026-06-25",
      tags: ["Dados", "Comunicacao"],
      blockedReason: "Dependencia externa",
      checklist: [
        { title: "Confirmar campos obrigatorios", isDone: true },
        { title: "Receber payload atualizado", isDone: false }
      ]
    }),
    createActivity({
      title: "Testes de usabilidade",
      description: "Rodar testes guiados com usuarios internos e consolidar aprendizados.",
      status: ActivityStatus.IN_REVIEW,
      priority: Priority.MEDIUM,
      assigneeId: gabrielle.id,
      dueDate: "2026-07-02",
      tags: ["UX"],
      checklist: [
        { title: "Preparar roteiro", isDone: true },
        { title: "Conduzir sessoes", isDone: true },
        { title: "Validar ajustes finais", isDone: false }
      ]
    }),
    createActivity({
      title: "Login com autenticacao 2FA",
      description: "Concluir autenticacao de dois fatores para usuarios administrativos.",
      status: ActivityStatus.DONE,
      priority: Priority.LOW,
      assigneeId: rogerio.id,
      dueDate: "2026-06-16",
      completedAt: "2026-06-16T18:30:00.000Z",
      tags: ["Seguranca"],
      checklist: [
        { title: "Gerar token temporario", isDone: true },
        { title: "Validar QR code", isDone: true },
        { title: "Registrar auditoria", isDone: true }
      ]
    })
  ]);

  await prisma.comment.createMany({
    data: [
      {
        activityId: activities[0].id,
        userId: ana.id,
        message: "Podemos reaproveitar os templates do fluxo de cobranca."
      },
      {
        activityId: activities[2].id,
        userId: matheus.id,
        message: "Aguardando retorno do fornecedor do CRM."
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
