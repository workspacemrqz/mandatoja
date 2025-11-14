import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollableSelect, ScrollableSelectContent, ScrollableSelectTrigger, ScrollableSelectValue } from "@/components/ui/scrollable-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { maskWhatsAppInput, unmaskWhatsApp } from "@/lib/utils";
import { insertVoterSchema } from "@shared/schema";
import type { Voter, ConfigOption, Leadership } from "@shared/schema";
import { z } from "zod";

interface VoterFormProps {
  voter?: Voter;
  onSuccess: () => void;
}

const voterFormSchema = insertVoterSchema.extend({
  nameSource: z.string().optional(),
});

type VoterFormData = z.infer<typeof voterFormSchema>;

export default function VoterForm({ voter, onSuccess }: VoterFormProps) {
  const isEditing = !!voter;

  const form = useForm<VoterFormData>({
    resolver: zodResolver(voterFormSchema),
    defaultValues: {
      nome: voter?.nome || "",
      whatsapp: maskWhatsAppInput(voter?.whatsapp || ""),
      voto: voter?.voto || "em_progresso",
      material: voter?.material || "sem_material",
      indicacao: voter?.indicacao || "",
      municipio: voter?.municipio || "",
      bairro: voter?.bairro ?? "",
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

  // Fetch leaderships for indicação options
  const { data: leaderships = [] } = useQuery<Leadership[]>({
    queryKey: ['/api/leaderships'],
  });

  // Fetch assessores for indicação options
  const { data: assessores = [] } = useQuery<Leadership[]>({
    queryKey: ['/api/assessores'],
  });

  // Combine leaderships, assessores, and a fixed "Agente Coletor" option
  const teamMembers = [
    ...leaderships, 
    ...assessores,
    {
      id: 'agente-coletor-static',
      nome: 'Agente Coletor',
      whatsapp: '',
      investimento: '',
      materialEnviado: '',
      municipio: '',
      bairro: '',
    }
  ];

  const createVoterMutation = useMutation({
    mutationFn: (data: VoterFormData) => apiRequest('/api/voters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voters'] });
      onSuccess();
    },
    onError: (error: any) => {
    },
  });

  const updateVoterMutation = useMutation({
    mutationFn: (data: VoterFormData) => apiRequest(`/api/voters/${voter!.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voters'] });
      onSuccess();
    },
    onError: (error: any) => {
    },
  });

  const onSubmit = (data: VoterFormData) => {
    const submitData = { 
      ...data,
      whatsapp: unmaskWhatsApp(data.whatsapp)
    };
    
    // Se editando e o nome mudou, marcar como edição manual
    if (isEditing && voter && data.nome !== voter.nome) {
      submitData.nameSource = 'manual';
    }
    
    if (isEditing) {
      updateVoterMutation.mutate(submitData);
    } else {
      createVoterMutation.mutate(submitData);
    }
  };

  const isPending = createVoterMutation.isPending || updateVoterMutation.isPending;

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
                  data-testid="input-voter-nome"
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
                  data-testid="input-voter-whatsapp"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={field.value}
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
          name="voto"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status do Voto</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-voter-voto">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="em_progresso">Em Progresso</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="material"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Material</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-voter-material">
                    <SelectValue placeholder="Selecione o material" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="sem_material">Sem Material</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="indicacao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Indicação</FormLabel>
              <ScrollableSelect onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <ScrollableSelectTrigger data-testid="select-voter-indicacao">
                    <ScrollableSelectValue placeholder="Selecione a indicação" />
                  </ScrollableSelectTrigger>
                </FormControl>
                <ScrollableSelectContent
                  items={teamMembers}
                  initialLoadCount={5}
                  loadMoreCount={5}
                  emptyMessage="Nenhuma indicação encontrada"
                />
              </ScrollableSelect>
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
                defaultValue={field.value}
              >
                <FormControl>
                  <ScrollableSelectTrigger data-testid="select-voter-municipio">
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
                defaultValue={field.value ?? undefined}
                disabled={!selectedMunicipio}
              >
                <FormControl>
                  <ScrollableSelectTrigger data-testid="select-voter-bairro">
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

        <div className="flex gap-3 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onSuccess}
            className="flex-1"
            data-testid="button-cancel-voter"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isPending}
            className="flex-1"
            data-testid="button-save-voter"
          >
            {isPending ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
