import { db } from "./db";
import { configOptions } from "@shared/schema";
import type { InsertConfigOption } from "@shared/schema";

async function seedConfigOptions() {
  console.log("🌱 Iniciando seed dos configOptions...");

  try {
    await db.transaction(async (tx) => {
      // Limpar configOptions existentes
      await tx.delete(configOptions);
      console.log("🗑️ ConfigOptions existentes removidos");

      // Dados para inserir
      const configOptionsData: InsertConfigOption[] = [
        // Municípios
        { fieldType: 'municipio', value: 'São Paulo', parentMunicipio: null },
        { fieldType: 'municipio', value: 'Campinas', parentMunicipio: null },
        { fieldType: 'municipio', value: 'Santos', parentMunicipio: null },
        { fieldType: 'municipio', value: 'São Sebastião', parentMunicipio: null },
        
        // Bairros de São Paulo
        { fieldType: 'bairro', value: 'Vila Madalena', parentMunicipio: 'São Paulo' },
        { fieldType: 'bairro', value: 'Itaim Bibi', parentMunicipio: 'São Paulo' },
        { fieldType: 'bairro', value: 'Moema', parentMunicipio: 'São Paulo' },
        { fieldType: 'bairro', value: 'Pinheiros', parentMunicipio: 'São Paulo' },
        { fieldType: 'bairro', value: 'Vila Olímpia', parentMunicipio: 'São Paulo' },
        { fieldType: 'bairro', value: 'Brooklin', parentMunicipio: 'São Paulo' },
        { fieldType: 'bairro', value: 'Jardins', parentMunicipio: 'São Paulo' },
        { fieldType: 'bairro', value: 'Perdizes', parentMunicipio: 'São Paulo' },
        
        // Bairros de Campinas
        { fieldType: 'bairro', value: 'Cambuí', parentMunicipio: 'Campinas' },
        { fieldType: 'bairro', value: 'Centro', parentMunicipio: 'Campinas' },
        { fieldType: 'bairro', value: 'Jardim Guanabara', parentMunicipio: 'Campinas' },
        { fieldType: 'bairro', value: 'Barão Geraldo', parentMunicipio: 'Campinas' },
        { fieldType: 'bairro', value: 'Taquaral', parentMunicipio: 'Campinas' },
        { fieldType: 'bairro', value: 'Swift', parentMunicipio: 'Campinas' },
        
        // Bairros de Santos
        { fieldType: 'bairro', value: 'Gonzaga', parentMunicipio: 'Santos' },
        { fieldType: 'bairro', value: 'Boqueirão', parentMunicipio: 'Santos' },
        { fieldType: 'bairro', value: 'Embaré', parentMunicipio: 'Santos' },
        { fieldType: 'bairro', value: 'Campo Grande', parentMunicipio: 'Santos' },
        { fieldType: 'bairro', value: 'José Menino', parentMunicipio: 'Santos' },
        { fieldType: 'bairro', value: 'Aparecida', parentMunicipio: 'Santos' },
        
        // Bairros de São Sebastião (exemplo mencionado pelo usuário)
        { fieldType: 'bairro', value: 'Boiçucanga', parentMunicipio: 'São Sebastião' },
        { fieldType: 'bairro', value: 'Maresias', parentMunicipio: 'São Sebastião' },
        { fieldType: 'bairro', value: 'Camburi', parentMunicipio: 'São Sebastião' },
        { fieldType: 'bairro', value: 'Centro', parentMunicipio: 'São Sebastião' },
        
        // Outras opções de configuração
        { fieldType: 'destinatario', value: 'eleitor', parentMunicipio: null },
        { fieldType: 'destinatario', value: 'municipio', parentMunicipio: null },
        { fieldType: 'destinatario', value: 'lideranca', parentMunicipio: null },
        
        { fieldType: 'tipo_entrega', value: 'presencial', parentMunicipio: null },
        { fieldType: 'tipo_entrega', value: 'online', parentMunicipio: null },
        
        { fieldType: 'indicacao', value: 'José da Silva', parentMunicipio: null },
        { fieldType: 'indicacao', value: 'Maria Santos', parentMunicipio: null },
        { fieldType: 'indicacao', value: 'Pedro Costa', parentMunicipio: null },
        { fieldType: 'indicacao', value: 'Ana Lima', parentMunicipio: null },
      ];

      // Inserir configOptions
      const insertedOptions = await tx.insert(configOptions).values(configOptionsData).returning();
      console.log(`✅ ${insertedOptions.length} configOptions inseridos`);
      console.log(`📍 ${insertedOptions.filter(o => o.fieldType === 'municipio').length} municípios`);
      console.log(`🏘️ ${insertedOptions.filter(o => o.fieldType === 'bairro').length} bairros`);
    });

    console.log("🎉 Seed de configOptions concluído com sucesso!");
    
    // Verificar contagens finais
    const optionsCount = await db.select().from(configOptions);
    const municipiosCount = optionsCount.filter(o => o.fieldType === 'municipio').length;
    const bairrosCount = optionsCount.filter(o => o.fieldType === 'bairro').length;
    console.log(`📊 Total: ${optionsCount.length} opções (${municipiosCount} municípios, ${bairrosCount} bairros)`);
    
  } catch (error) {
    console.error("❌ Erro durante o seed de configOptions:", error);
    process.exit(1);
  }
}

// Executar seed e encerrar processo
seedConfigOptions().then(() => {
  console.log("🏁 Seed de configOptions finalizado");
  process.exit(0);
}).catch((error) => {
  console.error("💥 Falha no seed de configOptions:", error);
  process.exit(1);
});

export { seedConfigOptions };