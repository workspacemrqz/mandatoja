/**
 * Vector Embedding Service using OpenAI API
 * Provides semantic search capabilities for Clone Agent knowledge base
 */

import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { cloneAgentKnowledge } from "@shared/schema";

interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class VectorEmbeddingService {
  private static instance: VectorEmbeddingService;
  
  private constructor() {
  }

  public static getInstance(): VectorEmbeddingService {
    if (!VectorEmbeddingService.instance) {
      VectorEmbeddingService.instance = new VectorEmbeddingService();
    }
    return VectorEmbeddingService.instance;
  }

  /**
   * Gera embedding para um texto usando OpenAI API
   */
  async generateEmbedding(text: string, openaiApiKey?: string): Promise<number[] | null> {
    try {
      const apiKey = openaiApiKey || process.env.OPENAI_API_KEY_EMBEDDINGS;
      
      if (!apiKey) {
        console.error("[VectorEmbedding] OPENAI_API_KEY_EMBEDDINGS não configurada");
        return null;
      }

      const apiUrl = "https://api.openai.com/v1/embeddings";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
          encoding_format: "float"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[VectorEmbedding] Erro na resposta da OpenAI API:", response.status, errorText);
        return null;
      }

      const data: OpenAIEmbeddingResponse = await response.json();
      
      return data.data[0].embedding;
    } catch (error) {
      console.error("[VectorEmbedding] Erro ao gerar embedding:", error);
      return null;
    }
  }

  /**
   * Busca semântica na base de conhecimento usando similaridade de cosseno
   */
  async semanticSearch(
    configId: string,
    queryText: string,
    limit: number = 5,
    openaiApiKey?: string
  ): Promise<Array<{ content: string; similarity: number }>> {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText, openaiApiKey);
      
      if (!queryEmbedding) {
        console.error("[VectorEmbedding] Não foi possível gerar embedding para a consulta");
        const allKnowledge = await db
          .select({ content: cloneAgentKnowledge.content })
          .from(cloneAgentKnowledge)
          .where(sql`${cloneAgentKnowledge.configId} = ${configId}`)
          .limit(limit);
        
        return allKnowledge.map(k => ({ content: k.content, similarity: 0 }));
      }

      const results = await db.execute(sql`
        SELECT 
          content,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM ${cloneAgentKnowledge}
        WHERE config_id = ${configId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `);

      const formattedResults = (results.rows as any[]).map(row => ({
        content: row.content,
        similarity: row.similarity
      }));

      return formattedResults;
    } catch (error) {
      console.error("[VectorEmbedding] Erro na busca semântica:", error);
      
      const allKnowledge = await db
        .select({ content: cloneAgentKnowledge.content })
        .from(cloneAgentKnowledge)
        .where(sql`${cloneAgentKnowledge.configId} = ${configId}`)
        .limit(limit);
      
      return allKnowledge.map(k => ({ content: k.content, similarity: 0 }));
    }
  }

  /**
   * Adiciona conhecimento com embedding vetorial
   */
  async addKnowledgeWithEmbedding(
    configId: string,
    content: string,
    openaiApiKey?: string
  ): Promise<boolean> {
    try {
      const embedding = await this.generateEmbedding(content, openaiApiKey);
      
      if (!embedding) {
        await db.insert(cloneAgentKnowledge).values({
          configId,
          content,
        });
        return true;
      }

      await db.execute(sql`
        INSERT INTO ${cloneAgentKnowledge} (config_id, content, embedding)
        VALUES (${configId}, ${content}, ${JSON.stringify(embedding)}::vector)
      `);

      return true;
    } catch (error) {
      console.error("[VectorEmbedding] Erro ao adicionar conhecimento:", error);
      
      try {
        await db.insert(cloneAgentKnowledge).values({
          configId,
          content,
        });
        return true;
      } catch (fallbackError) {
        console.error("[VectorEmbedding] Erro no fallback:", fallbackError);
        return false;
      }
    }
  }

  /**
   * Atualiza embeddings para conhecimentos existentes sem embedding
   */
  async updateMissingEmbeddings(configId: string, openaiApiKey?: string): Promise<void> {
    try {
      const knowledgeWithoutEmbedding = await db
        .select({ id: cloneAgentKnowledge.id, content: cloneAgentKnowledge.content })
        .from(cloneAgentKnowledge)
        .where(sql`
          ${cloneAgentKnowledge.configId} = ${configId}
          AND ${cloneAgentKnowledge.embedding} IS NULL
        `);

      for (const knowledge of knowledgeWithoutEmbedding) {
        const embedding = await this.generateEmbedding(knowledge.content, openaiApiKey);
        
        if (embedding) {
          await db.execute(sql`
            UPDATE ${cloneAgentKnowledge}
            SET embedding = ${JSON.stringify(embedding)}::vector
            WHERE id = ${knowledge.id}
          `);
        }
      }
    } catch (error) {
      console.error("[VectorEmbedding] Erro ao atualizar embeddings:", error);
    }
  }
}

export const vectorEmbedding = VectorEmbeddingService.getInstance();