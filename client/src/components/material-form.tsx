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
import { insertCampaignMaterialSchema } from "@shared/schema";
import type { CampaignMaterial, InsertCampaignMaterial, Leadership } from "@shared/schema";

interface MaterialFormProps {
  material?: CampaignMaterial;
  onSuccess: () => void;
}

export default function MaterialForm({ material, onSuccess }: MaterialFormProps) {
  const isEditing = !!material;

  const form = useForm<InsertCampaignMaterial>({
    resolver: zodResolver(insertCampaignMaterialSchema),
    defaultValues: {
      tipoMaterial: material?.tipoMaterial || "",
      entrega: material?.entrega || "Online",
      destinatario: material?.destinatario || "",
      quantidade: material?.quantidade || 0,
      status: material?.status || "em_preparacao",
    },
  });

  // Fetch leaderships for destinatário options
  const { data: leaderships = [] } = useQuery<Leadership[]>({
    queryKey: ['/api/leaderships'],
  });

  // Fetch assessores for destinatário options
  const { data: assessores = [] } = useQuery<Leadership[]>({
    queryKey: ['/api/assessores'],
  });

  // Combine leaderships and assessores
  const teamMembers = [...leaderships, ...assessores];

  // Hardcoded delivery type options
  const tipoEntregaOptions = [
    { id: "presencial", value: "Presencial", label: "Presencial" },
    { id: "online", value: "Online", label: "Online" }
  ];

  const createMaterialMutation = useMutation({
    mutationFn: (data: InsertCampaignMaterial) => apiRequest('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
      onSuccess();
    },
    onError: () => {
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: (data: InsertCampaignMaterial) => apiRequest(`/api/materials/${material!.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
      onSuccess();
    },
    onError: () => {
    },
  });

  const onSubmit = (data: InsertCampaignMaterial) => {
    if (isEditing) {
      updateMaterialMutation.mutate(data);
    } else {
      createMaterialMutation.mutate(data);
    }
  };

  const isPending = createMaterialMutation.isPending || updateMaterialMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="tipoMaterial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Material</FormLabel>
              <FormControl>
                <Input 
                  data-testid="input-material-tipo"
                  placeholder="Ex: Panfleto, Camiseta, Adesivo" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="entrega"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Entrega</FormLabel>
              <ScrollableSelect onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <ScrollableSelectTrigger data-testid="select-material-entrega">
                    <ScrollableSelectValue placeholder="Selecione o tipo" />
                  </ScrollableSelectTrigger>
                </FormControl>
                <ScrollableSelectContent
                  items={tipoEntregaOptions}
                  initialLoadCount={5}
                  loadMoreCount={5}
                  emptyMessage="Nenhum tipo encontrado"
                />
              </ScrollableSelect>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="destinatario"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destinatário</FormLabel>
              <ScrollableSelect onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <ScrollableSelectTrigger data-testid="select-material-destinatario">
                    <ScrollableSelectValue placeholder="Selecione o destinatário" />
                  </ScrollableSelectTrigger>
                </FormControl>
                <ScrollableSelectContent
                  items={teamMembers}
                  initialLoadCount={5}
                  loadMoreCount={5}
                  emptyMessage="Nenhum destinatário encontrado"
                />
              </ScrollableSelect>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="quantidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade</FormLabel>
              <FormControl>
                <Input 
                  data-testid="input-material-quantidade"
                  type="number"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-material-status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="em_preparacao">Em Preparação</SelectItem>
                  <SelectItem value="distribuido">Distribuído</SelectItem>
                </SelectContent>
              </Select>
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
            data-testid="button-cancel-material"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isPending}
            className="flex-1"
            data-testid="button-save-material"
          >
            {isPending ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
