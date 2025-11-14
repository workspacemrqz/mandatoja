/**
 * Simplified Vector Embedding Service using OpenAI API with TF-IDF fallback
 * Stores embeddings as JSON in text columns (workaround for pgvector issues)
 * Falls back to TF-IDF when OpenAI is unavailable
 */

import { db } from "../db.js";
import { cloneAgentKnowledge } from "@shared/schema";
import { eq } from "drizzle-orm";
import { tfidfEmbedding } from "./tfidf-embeddings.js";

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
    // Serviço iniciado
  }

  public static getInstance(): VectorEmbeddingService {
    if (!VectorEmbeddingService.instance) {
      VectorEmbeddingService.instance = new VectorEmbeddingService();
    }
    return VectorEmbeddingService.instance;
  }

  /**
   * Normaliza texto para busca por palavras-chave
   */
  private normalizeText(text: string): string[] {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^\w\s]/g, " ") // Remove pontuação
      .split(/\s+/)
      .filter(word => word.length > 2); // Remove palavras muito curtas
  }

  /**
   * Calcula score de relevância baseado em palavras-chave
   */
  private calculateKeywordScore(query: string, content: string): number {
    const queryWords = this.normalizeText(query);
    const contentWords = this.normalizeText(content.toLowerCase());
    
    if (queryWords.length === 0) return 0;
    
    let matchCount = 0;
    let exactMatchCount = 0;
    
    // Contar matches de palavras
    for (const queryWord of queryWords) {
      if (contentWords.includes(queryWord)) {
        exactMatchCount++;
      } else {
        // Busca parcial (palavra dentro de outra)
        for (const contentWord of contentWords) {
          if (contentWord.includes(queryWord) || queryWord.includes(contentWord)) {
            matchCount++;
            break;
          }
        }
      }
    }
    
    // Calcular score (prioriza matches exatos)
    const exactScore = exactMatchCount / queryWords.length;
    const partialScore = matchCount / (queryWords.length * 2);
    
    return Math.min(exactScore + partialScore, 1);
  }

  /**
   * Calcula similaridade de cosseno entre dois vetores
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  /**
   * Gera embedding para um texto usando OpenAI API
   */
  async generateEmbedding(text: string, openaiApiKey?: string): Promise<number[] | null> {
    try {
      // Usa OPENAI_API_KEY como principal, OPENAI_API_KEY_EMBEDDINGS como fallback
      const apiKey = openaiApiKey || process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_EMBEDDINGS;
      
      if (!apiKey) {
        console.warn("[VectorEmbedding] ⚠️ OPENAI_API_KEY não configurada");
        console.warn("[VectorEmbedding] ℹ️ Sistema continuará funcionando sem busca semântica avançada");
        return null;
      }

      // OpenAI API endpoint
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
        
        // Parse error to check for insufficient_quota
        try {
          const errorObj = JSON.parse(errorText);
          if (errorObj.error?.code === "insufficient_quota" || response.status === 429) {
            console.warn("[VectorEmbedding] ⚠️ Cota da API OpenAI excedida. Continuando sem embeddings...");
            console.warn("[VectorEmbedding] ℹ️ Para resolver: Verifique seu plano e faturamento em https://platform.openai.com/account/billing");
          } else {
            console.error("[VectorEmbedding] ❌ Erro na resposta da OpenAI API:", response.status);
            console.error("[VectorEmbedding] ❌ Detalhes do erro:", errorText);
          }
        } catch {
          console.error("[VectorEmbedding] ❌ Erro na resposta da OpenAI API:", response.status);
          console.error("[VectorEmbedding] ❌ Detalhes do erro:", errorText);
        }
        
        return null;
      }

      const data: OpenAIEmbeddingResponse = await response.json();
      console.log("[VectorEmbedding] ✅ Embedding gerado com sucesso via OpenAI API");
      console.log(`[VectorEmbedding] 📊 Tokens usados: ${data.usage.total_tokens}`);
      
      return data.data[0].embedding;
    } catch (error) {
      console.error("[VectorEmbedding] ❌ Erro ao gerar embedding:", error);
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
      // Gerar embedding para a consulta
      const queryEmbedding = await this.generateEmbedding(queryText, openaiApiKey);
      
      if (!queryEmbedding) {
        console.warn("[VectorEmbedding] ⚠️ OpenAI não disponível - usando TF-IDF (100% offline)");
        
        // Usar TF-IDF como fallback principal
        const tfidfResults = await tfidfEmbedding.semanticSearch(configId, queryText, limit);
        
        // Se TF-IDF retornar resultados válidos, usá-los
        if (tfidfResults.length > 0 && tfidfResults.some(r => r.similarity > 0)) {
          return tfidfResults;
        }
        
        // Fallback secundário: busca por palavras-chave simples
        console.warn("[VectorEmbedding] ⚠️ Usando busca por palavras-chave como fallback final");
        const allKnowledge = await db
          .select()
          .from(cloneAgentKnowledge)
          .where(eq(cloneAgentKnowledge.configId, configId));
        
        // Calcular relevância por palavras-chave
        const results = allKnowledge
          .map(k => ({
            content: k.content,
            similarity: this.calculateKeywordScore(queryText, k.content)
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
        
        return results;
      }

      console.log(`[VectorEmbedding] 🔍 Buscando conhecimentos similares para config ${configId}`);

      // Buscar todos os conhecimentos da config
      const allKnowledge = await db
        .select()
        .from(cloneAgentKnowledge)
        .where(eq(cloneAgentKnowledge.configId, configId));

      // Calcular similaridade para cada conhecimento
      const results = allKnowledge
        .map(knowledge => {
          if (!knowledge.embedding) {
            return { content: knowledge.content, similarity: 0 };
          }
          
          try {
            const knowledgeEmbedding = JSON.parse(knowledge.embedding);
            const similarity = this.cosineSimilarity(queryEmbedding, knowledgeEmbedding);
            return { content: knowledge.content, similarity };
          } catch (error) {
            console.error("[VectorEmbedding] Erro ao parsear embedding:", error);
            return { content: knowledge.content, similarity: 0 };
          }
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.log(`[VectorEmbedding] ✅ Encontrados ${results.length} resultados similares`);
      
      return results;
    } catch (error) {
      console.error("[VectorEmbedding] ❌ Erro na busca semântica:", error);
      console.warn("[VectorEmbedding] ⚠️ Usando TF-IDF como fallback após erro");
      
      try {
        // Tentar TF-IDF primeiro
        const tfidfResults = await tfidfEmbedding.semanticSearch(configId, queryText, limit);
        if (tfidfResults.length > 0) {
          return tfidfResults;
        }
      } catch (tfidfError) {
        console.error("[VectorEmbedding] ❌ TF-IDF também falhou:", tfidfError);
      }
      
      // Fallback final: busca por palavras-chave
      console.warn("[VectorEmbedding] ⚠️ Usando busca simples como fallback final");
      const allKnowledge = await db
        .select()
        .from(cloneAgentKnowledge)
        .where(eq(cloneAgentKnowledge.configId, configId));
      
      const results = allKnowledge
        .map(k => ({
          content: k.content,
          similarity: this.calculateKeywordScore(queryText, k.content)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      return results;
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
      console.log(`[VectorEmbedding] 📝 Adicionando conhecimento com embedding para config ${configId}`);
      
      // Gerar embedding para o conteúdo
      const embedding = await this.generateEmbedding(content, openaiApiKey);
      
      if (!embedding) {
        console.warn("[VectorEmbedding] ⚠️ Adicionando conhecimento sem embedding (fallback)");
        // Adicionar sem embedding como fallback
        await db.insert(cloneAgentKnowledge).values({
          configId,
          content,
          embedding: null,
        });
        return true;
      }

      // Adicionar conhecimento com embedding (como JSON)
      await db.insert(cloneAgentKnowledge).values({
        configId,
        content,
        embedding: JSON.stringify(embedding),
      });

      console.log("[VectorEmbedding] ✅ Conhecimento adicionado com embedding");
      return true;
    } catch (error) {
      console.error("[VectorEmbedding] ❌ Erro ao adicionar conhecimento:", error);
      
      // Tentar adicionar sem embedding como fallback
      try {
        await db.insert(cloneAgentKnowledge).values({
          configId,
          content,
          embedding: null,
        });
        return true;
      } catch (fallbackError) {
        console.error("[VectorEmbedding] ❌ Erro no fallback:", fallbackError);
        return false;
      }
    }
  }

  /**
   * Atualiza embeddings para conhecimentos existentes sem embedding
   */
  async updateMissingEmbeddings(configId: string, openaiApiKey?: string): Promise<void> {
    try {
      console.log(`[VectorEmbedding] 🔄 Atualizando embeddings faltantes para config ${configId}`);
      
      // Buscar conhecimentos sem embedding
      const knowledgeWithoutEmbedding = await db
        .select()
        .from(cloneAgentKnowledge)
        .where(eq(cloneAgentKnowledge.configId, configId));

      const missingEmbeddings = knowledgeWithoutEmbedding.filter(k => !k.embedding);

      console.log(`[VectorEmbedding] 📊 ${missingEmbeddings.length} conhecimentos sem embedding`);

      for (const knowledge of missingEmbeddings) {
        const embedding = await this.generateEmbedding(knowledge.content, openaiApiKey);
        
        if (embedding) {
          await db
            .update(cloneAgentKnowledge)
            .set({ embedding: JSON.stringify(embedding) })
            .where(eq(cloneAgentKnowledge.id, knowledge.id));
          
          console.log(`[VectorEmbedding] ✅ Embedding atualizado para conhecimento ${knowledge.id}`);
        }
      }

      console.log("[VectorEmbedding] ✅ Atualização de embeddings concluída");
    } catch (error) {
      console.error("[VectorEmbedding] ❌ Erro ao atualizar embeddings:", error);
    }
  }
}

export const vectorEmbedding = VectorEmbeddingService.getInstance();