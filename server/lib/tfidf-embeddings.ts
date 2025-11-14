/**
 * TF-IDF Embeddings Service
 * Alternativa offline para embeddings vetoriais usando TF-IDF
 * Não depende de APIs externas e funciona localmente
 */

import { db } from "../db.js";
import { cloneAgentKnowledge } from "@shared/schema";
import { eq } from "drizzle-orm";

export class TFIDFEmbeddingService {
  private static instance: TFIDFEmbeddingService;
  
  private constructor() {
    // Ready
  }

  public static getInstance(): TFIDFEmbeddingService {
    if (!TFIDFEmbeddingService.instance) {
      TFIDFEmbeddingService.instance = new TFIDFEmbeddingService();
    }
    return TFIDFEmbeddingService.instance;
  }

  /**
   * Tokeniza e normaliza texto
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^\w\s]/g, " ") // Remove pontuação
      .split(/\s+/)
      .filter(word => word.length > 2); // Remove palavras muito curtas
  }

  /**
   * Calcula TF (Term Frequency)
   */
  private calculateTF(terms: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    const totalTerms = terms.length;
    
    if (totalTerms === 0) return tf;
    
    // Contar frequência de cada termo
    for (const term of terms) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }
    
    // Normalizar pela quantidade total de termos
    for (const [term, count] of tf) {
      tf.set(term, count / totalTerms);
    }
    
    return tf;
  }

  /**
   * Calcula IDF (Inverse Document Frequency)
   */
  private calculateIDF(documents: string[][], term: string): number {
    const docsWithTerm = documents.filter(doc => doc.includes(term)).length;
    if (docsWithTerm === 0) return 0;
    return Math.log(documents.length / docsWithTerm);
  }

  /**
   * Calcula vetor TF-IDF para um documento
   */
  private calculateTFIDF(document: string[], allDocuments: string[][]): Map<string, number> {
    const tfidf = new Map<string, number>();
    const tf = this.calculateTF(document);
    
    for (const [term, tfValue] of tf) {
      const idf = this.calculateIDF(allDocuments, term);
      tfidf.set(term, tfValue * idf);
    }
    
    return tfidf;
  }

  /**
   * Calcula similaridade de cosseno entre dois vetores TF-IDF
   */
  private cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
    // Obter todos os termos únicos
    const allTerms = new Set([...vec1.keys(), ...vec2.keys()]);
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const term of allTerms) {
      const val1 = vec1.get(term) || 0;
      const val2 = vec2.get(term) || 0;
      
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Busca semântica usando TF-IDF
   */
  async semanticSearch(
    configId: string,
    queryText: string,
    limit: number = 5
  ): Promise<Array<{ content: string; similarity: number }>> {
    try {
      console.log(`[TF-IDF] 🔍 Realizando busca semântica TF-IDF para config ${configId}`);
      
      // Buscar todos os conhecimentos
      const allKnowledge = await db
        .select()
        .from(cloneAgentKnowledge)
        .where(eq(cloneAgentKnowledge.configId, configId));
      
      if (allKnowledge.length === 0) {
        console.log("[TF-IDF] 📭 Nenhum conhecimento encontrado");
        return [];
      }
      
      // Tokenizar query e documentos
      const queryTokens = this.tokenize(queryText);
      const documentTokens = allKnowledge.map(k => this.tokenize(k.content));
      
      // Adicionar query aos documentos para cálculo de IDF
      const allDocuments = [...documentTokens, queryTokens];
      
      // Calcular TF-IDF para a query
      const queryTFIDF = this.calculateTFIDF(queryTokens, allDocuments);
      
      // Calcular similaridade para cada documento
      const results = allKnowledge
        .map((knowledge, index) => {
          const docTokens = documentTokens[index];
          const docTFIDF = this.calculateTFIDF(docTokens, allDocuments);
          const similarity = this.cosineSimilarity(queryTFIDF, docTFIDF);
          
          return {
            content: knowledge.content,
            similarity
          };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      console.log(`[TF-IDF] ✅ Encontrados ${results.length} resultados similares`);
      results.forEach((r, idx) => {
        if (r.similarity > 0) {
          console.log(`[TF-IDF]    ${idx + 1}. Similaridade: ${(r.similarity * 100).toFixed(1)}% - ${r.content.substring(0, 50)}...`);
        }
      });
      
      return results;
    } catch (error) {
      console.error("[TF-IDF] ❌ Erro na busca TF-IDF:", error);
      
      // Fallback: retornar primeiros conhecimentos
      const allKnowledge = await db
        .select()
        .from(cloneAgentKnowledge)
        .where(eq(cloneAgentKnowledge.configId, configId))
        .limit(limit);
      
      return allKnowledge.map(k => ({ content: k.content, similarity: 0 }));
    }
  }
}

export const tfidfEmbedding = TFIDFEmbeddingService.getInstance();