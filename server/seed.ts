import { db } from "./db";
import { users, voters, campaignMaterials, insertVoterSchema, insertCampaignMaterialSchema } from "@shared/schema";
import type { InsertVoter, InsertCampaignMaterial } from "@shared/schema";

async function seedDatabase() {
  console.log("🌱 Iniciando seed do banco de dados...");

  try {
    await db.transaction(async (tx) => {
      // Limpar dados existentes (apenas para desenvolvimento)
      await tx.delete(campaignMaterials);
      await tx.delete(voters);
      
      console.log("🗑️ Dados existentes removidos");

      // Inserir 20 eleitores
      const votersData: InsertVoter[] = [
        { nome: "Maria Silva Santos", whatsapp: "(11) 99999-0001", voto: "confirmado", material: "entregue", municipio: "São Paulo", bairro: "Vila Madalena", indicacao: "José da Silva" },
        { nome: "João Pereira Lima", whatsapp: "(11) 99999-0002", voto: "em_progresso", material: "enviado", municipio: "São Paulo", bairro: "Itaim Bibi", indicacao: "Maria Santos" },
        { nome: "Ana Costa Oliveira", whatsapp: "(11) 99999-0003", voto: "confirmado", material: "entregue", municipio: "Campinas", bairro: "Cambuí", indicacao: "Pedro Costa" },
        { nome: "Carlos Alberto Souza", whatsapp: "(11) 99999-0004", voto: "confirmado", material: "entregue", municipio: "São Paulo", bairro: "Moema", indicacao: "José da Silva" },
        { nome: "Fernanda Dias Rocha", whatsapp: "(11) 99999-0005", voto: "em_progresso", material: "sem_material", municipio: "Santos", bairro: "Gonzaga", indicacao: "Ana Lima" },
        { nome: "Ricardo Mendes Alves", whatsapp: "(11) 99999-0006", voto: "confirmado", material: "enviado", municipio: "Campinas", bairro: "Centro", indicacao: "Pedro Costa" },
        { nome: "Patricia Ferreira Cruz", whatsapp: "(11) 99999-0007", voto: "confirmado", material: "entregue", municipio: "São Paulo", bairro: "Pinheiros", indicacao: "Maria Santos" },
        { nome: "Roberto Carlos Silva", whatsapp: "(11) 99999-0008", voto: "em_progresso", material: "enviado", municipio: "Santos", bairro: "Boqueirão", indicacao: "Ana Lima" },
        { nome: "Luciana Barbosa Reis", whatsapp: "(11) 99999-0009", voto: "confirmado", material: "entregue", municipio: "Campinas", bairro: "Jardim Guanabara", indicacao: "Pedro Costa" },
        { nome: "Marcos Vinicius Lima", whatsapp: "(11) 99999-0010", voto: "confirmado", material: "entregue", municipio: "São Paulo", bairro: "Vila Olímpia", indicacao: "José da Silva" },
        { nome: "Juliana Cardoso Nunes", whatsapp: "(11) 99999-0011", voto: "em_progresso", material: "sem_material", municipio: "Santos", bairro: "Embaré", indicacao: "Ana Lima" },
        { nome: "André Luiz Machado", whatsapp: "(11) 99999-0012", voto: "confirmado", material: "enviado", municipio: "Campinas", bairro: "Barão Geraldo", indicacao: "Pedro Costa" },
        { nome: "Carla Regina Torres", whatsapp: "(11) 99999-0013", voto: "confirmado", material: "entregue", municipio: "São Paulo", bairro: "Brooklin", indicacao: "Maria Santos" },
        { nome: "Paulo Henrique Gomes", whatsapp: "(11) 99999-0014", voto: "em_progresso", material: "enviado", municipio: "Santos", bairro: "Campo Grande", indicacao: "Ana Lima" },
        { nome: "Renata Almeida Costa", whatsapp: "(11) 99999-0015", voto: "confirmado", material: "entregue", municipio: "Campinas", bairro: "Taquaral", indicacao: "Pedro Costa" },
        { nome: "Felipe Santos Barros", whatsapp: "(11) 99999-0016", voto: "confirmado", material: "entregue", municipio: "São Paulo", bairro: "Jardins", indicacao: "José da Silva" },
        { nome: "Cristina Moura Silva", whatsapp: "(11) 99999-0017", voto: "em_progresso", material: "sem_material", municipio: "Santos", bairro: "José Menino", indicacao: "Ana Lima" },
        { nome: "Daniel Rodrigues Lima", whatsapp: "(11) 99999-0018", voto: "confirmado", material: "enviado", municipio: "Campinas", bairro: "Swift", indicacao: "Pedro Costa" },
        { nome: "Gabriela Freitas Melo", whatsapp: "(11) 99999-0019", voto: "confirmado", material: "entregue", municipio: "São Paulo", bairro: "Perdizes", indicacao: "Maria Santos" },
        { nome: "Thiago Cunha Ramos", whatsapp: "(11) 99999-0020", voto: "em_progresso", material: "enviado", municipio: "Santos", bairro: "Aparecida", indicacao: "Ana Lima" }
      ];

      // Validar e inserir eleitores
      const validatedVoters = votersData.map(voter => insertVoterSchema.parse(voter));
      const insertedVoters = await tx.insert(voters).values(validatedVoters).returning();
      console.log(`✅ ${insertedVoters.length} eleitores inseridos`);

      // Inserir 3 materiais de campanha
      const materialsData: InsertCampaignMaterial[] = [
        {
          tipoMaterial: "Adesivos",
          entrega: "presencial",
          destinatario: "eleitor", 
          quantidade: 500,
          status: "distribuido"
        },
        {
          tipoMaterial: "Flyers Digitais",
          entrega: "online",
          destinatario: "municipio",
          quantidade: 1000,
          status: "em_preparacao"
        },
        {
          tipoMaterial: "Camisetas",
          entrega: "presencial",
          destinatario: "lideranca",
          quantidade: 50,
          status: "distribuido"
        }
      ];

      // Validar e inserir materiais
      const validatedMaterials = materialsData.map(material => insertCampaignMaterialSchema.parse(material));
      const insertedMaterials = await tx.insert(campaignMaterials).values(validatedMaterials).returning();
      console.log(`✅ ${insertedMaterials.length} materiais de campanha inseridos`);
    });

    console.log("🎉 Seed concluído com sucesso!");
    
    // Verificar contagens finais
    const voterCount = await db.select().from(voters);
    const materialCount = await db.select().from(campaignMaterials);
    console.log(`📊 Total no banco: ${voterCount.length} eleitores, ${materialCount.length} materiais`);
    
  } catch (error) {
    console.error("❌ Erro durante o seed:", error);
    process.exit(1);
  }
}

// Executar seed e encerrar processo
seedDatabase().then(() => {
  console.log("🏁 Seed finalizado");
  process.exit(0);
}).catch((error) => {
  console.error("💥 Falha no seed:", error);
  process.exit(1);
});

export { seedDatabase };