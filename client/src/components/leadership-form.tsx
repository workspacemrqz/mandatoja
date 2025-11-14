import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollableSelect, ScrollableSelectContent, ScrollableSelectTrigger, ScrollableSelectValue } from "@/components/ui/scrollable-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { maskWhatsAppInput, unmaskWhatsApp } from "@/lib/utils";
import { insertLeadershipSchema, insertAssessorSchema } from "@shared/schema";
import type { Leadership, InsertLeadership, Assessor, InsertAssessor, ConfigOption, CampaignMaterial } from "@shared/schema";

interface LeadershipFormProps {
  type: 'leadership' | 'assessor';
  leadership?: Leadership | Assessor;
  onSuccess: () => void;
}

export default function LeadershipForm({ type, leadership, onSuccess }: LeadershipFormProps) {
  const isEditing = !!leadership;
  
  const apiEndpoint = type === 'leadership' ? '/api/leaderships' : '/api/assessores';
  const entityLabel = type === 'leadership' ? 'Liderança' : 'Assessor';
  const schema = type === 'leadership' ? insertLeadershipSchema : insertAssessorSchema;

  const form = useForm<InsertLeadership | InsertAssessor>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: leadership?.nome || "",
      whatsapp: maskWhatsAppInput(leadership?.whatsapp ?? ""),
      investimento: leadership?.investimento ?? "",
      materialEnviado: leadership?.materialEnviado ?? "",
      municipio: leadership?.municipio ?? "",
      bairro: leadership?.bairro ?? "",
      anotacoes: leadership?.anotacoes ?? "",
    },
  });

  const selectedMunicipio = form.watch('municipio');

  // Fetch município configuration options
  const { data: municipioOptions = [] } = useQuery<ConfigOption[]>({
    queryKey: ['/api/config-options/municipio'],
  });

  // Fetch bairro configuration options - filtered by selected município
  const { data: bairroOptions = [] } = useQuery<ConfigOption[]>({
    queryKey: selectedMunicipio 
      ? ['/api/config-options/bairro', { municipio: selectedMunicipio }]
      : ['/api/config-options/bairro'],
    queryFn: selectedMunicipio
      ? async () => {
          const response = await fetch(`/api/config-options/bairro?municipio=${encodeURIComponent(selectedMunicipio)}`);
          if (!response.ok) throw new Error('Failed to fetch bairros');
          return response.json();
        }
      : undefined,
    enabled: !!selectedMunicipio,
  });

  // Fetch campaign materials for material selection
  const { data: campaignMaterials = [] } = useQuery<CampaignMaterial[]>({
    queryKey: ['/api/materials'],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertLeadership | InsertAssessor) => apiRequest(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      onSuccess();
    },
    onError: (error: any) => {
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertLeadership | InsertAssessor) => apiRequest(`${apiEndpoint}/${leadership!.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      onSuccess();
    },
    onError: (error: any) => {
    },
  });

  const onSubmit = (data: InsertLeadership | InsertAssessor) => {
    const submitData = {
      ...data,
      whatsapp: unmaskWhatsApp(data.whatsapp ?? "")
    };
    
    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input 
                  data-testid="input-leadership-nome"
                  placeholder="Nome completo" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp</FormLabel>
              <FormControl>
                <Input 
                  data-testid="input-leadership-whatsapp"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const masked = maskWhatsAppInput(e.target.value);
                    field.onChange(masked);
                  }}
                  maxLength={21}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="investimento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Investimento</FormLabel>
              <FormControl>
                <Input 
                  data-testid="input-leadership-investimento"
                  placeholder="R$ 1.000,00" 
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="materialEnviado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Material Enviado</FormLabel>
              <FormControl>
                <Textarea 
                  data-testid="input-leadership-material"
                  placeholder="Descreva os materiais e quantidades enviados..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="municipio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Município</FormLabel>
              <ScrollableSelect 
                onValueChange={(value) => {
                  field.onChange(value);
                  // Limpar bairro quando município mudar
                  form.setValue('bairro', '');
                }} 
                value={field.value ?? undefined}
              >
                <FormControl>
                  <ScrollableSelectTrigger data-testid="select-leadership-municipio">
                    <ScrollableSelectValue placeholder="Selecione o município" />
                  </ScrollableSelectTrigger>
                </FormControl>
                <ScrollableSelectContent
                  items={municipioOptions}
                  initialLoadCount={5}
                  loadMoreCount={5}
                  emptyMessage="Nenhum município encontrado"
                />
              </ScrollableSelect>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bairro"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bairro</FormLabel>
              <ScrollableSelect 
                onValueChange={field.onChange} 
                value={field.value ?? undefined}
                disabled={!selectedMunicipio}
              >
                <FormControl>
                  <ScrollableSelectTrigger data-testid="select-leadership-bairro">
                    <ScrollableSelectValue placeholder={!selectedMunicipio ? "Selecione primeiro o município" : "Selecione o bairro"} />
                  </ScrollableSelectTrigger>
                </FormControl>
                <ScrollableSelectContent
                  items={bairroOptions}
                  initialLoadCount={5}
                  loadMoreCount={5}
                  emptyMessage={!selectedMunicipio ? "Selecione o município primeiro" : "Nenhum bairro disponível"}
                />
              </ScrollableSelect>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="anotacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Anotações</FormLabel>
              <FormControl>
                <Textarea 
                  data-testid="input-leadership-anotacoes"
                  placeholder="Anotações sobre a liderança..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button 
            data-testid="button-submit-leadership"
            type="submit" 
            disabled={isPending}
          >
            {isPending ? "Salvando..." : isEditing ? "Atualizar" : "Criar"} {entityLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}