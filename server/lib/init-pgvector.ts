/**
 * Initialize pgvector extension in PostgreSQL
 */

import { db } from "../db.js";
import { sql } from "drizzle-orm";

export async function initializePgVector(): Promise<void> {
  try {
    console.log("[PgVector] 🔧 Inicializando extensão pgvector...");
    
    // Criar extensão pgvector se não existir
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    
    console.log("[PgVector] ✅ Extensão pgvector configurada com sucesso");
    
    // Nota: A coluna embedding está armazenada como text (workaround para suporte Drizzle)
    // Índices vetoriais serão criados quando a coluna for migrada para o tipo vector
    
  } catch (error: any) {
    // Se a extensão já existir ou não puder ser criada (falta de permissões), não é erro crítico
    if (error.message?.includes("already exists") || error.message?.includes("extension \"vector\"")) {
      console.log("[PgVector] ℹ️ Extensão pgvector já existe");
    } else if (error.message?.includes("permission denied") || error.message?.includes("superuser")) {
      console.warn("[PgVector] ⚠️ Sem permissões para criar extensão pgvector. Funcionalidade vetorial pode estar limitada.");
      console.warn("[PgVector] ⚠️ Execute manualmente: CREATE EXTENSION IF NOT EXISTS vector;");
    } else {
      console.error("[PgVector] ❌ Erro ao inicializar pgvector:", error.message);
    }
  }
}