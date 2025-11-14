import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Folder, Cloud, Hand, Settings2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import MaterialForm from "./material-form.tsx";
import type { CampaignMaterial } from "@shared/schema";
import MaterialIcon from "@/assets/icons/Material.svg";

export default function MaterialsTab() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<CampaignMaterial | null>(null);

  const { data: materials = [], isLoading } = useQuery<CampaignMaterial[]>({
    queryKey: ['/api/materials'],
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/materials/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
    },
    onError: () => {
    },
  });

  const exportExcelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/materials/export-excel');
      if (!response.ok) throw new Error('Erro ao exportar');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `materiais_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
    },
    onError: () => {
    },
  });

  const totalMaterials = materials.length;
  const onlineMaterials = materials.filter(m => m.entrega === 'online').length;
  const presencialMaterials = materials.filter(m => m.entrega === 'presencial').length;

  const getDeliveryBadge = (entrega: string) => {
    return entrega === 'online' ? (
      <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10">Online</Badge>
    ) : (
      <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10">Presencial</Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    return status === 'distribuido' ? (
      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/10">Distribuído</Badge>
    ) : (
      <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/10">Em Preparação</Badge>
    );
  };

  const getMaterialIcon = (tipo: string) => {
    // Simple icon mapping based on material type
    return (
      <img 
        src={MaterialIcon} 
        alt="Material" 
        className="w-5 h-5" 
        style={{filter: 'brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(1917%) hue-rotate(204deg) brightness(95%) contrast(101%)'}} 
      />
    );
  };

  const handleDeleteMaterial = (id: string) => {
    if (confirm("Tem certeza que deseja remover este material?")) {
      deleteMaterialMutation.mutate(id);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-3xl font-bold text-foreground">Material de Campanha</h2>
            <p className="text-muted-foreground mt-2">Gestão de materiais de campanha</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  data-testid="button-funcionalidades-material" 
                  variant="outline"
                  disabled={exportExcelMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  Funcionalidades
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  data-testid="menu-item-export-excel-material"
                  onClick={() => exportExcelMutation.mutate()}
                  disabled={exportExcelMutation.isPending}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-material" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Material
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Material</DialogTitle>
                </DialogHeader>
                <MaterialForm onSuccess={() => setIsAddModalOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Material Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Materiais</p>
                  <p className="text-2xl font-bold text-card-foreground" data-testid="metric-total-materials">
                    {totalMaterials}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <img 
                    src={MaterialIcon} 
                    alt="Material" 
                    className="w-6 h-6" 
                    style={{filter: 'brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(1917%) hue-rotate(204deg) brightness(95%) contrast(101%)'}} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entrega Online</p>
                  <p className="text-2xl font-bold text-card-foreground" data-testid="metric-online-materials">
                    {onlineMaterials}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entrega Presencial</p>
                  <p className="text-2xl font-bold text-card-foreground" data-testid="metric-presencial-materials">
                    {presencialMaterials}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Hand className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Material Table - Desktop */}
        <Card className="hidden md:block bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Tipo de Material</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Entrega</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Destinatário</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Quantidade</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Carregando materiais...
                    </td>
                  </tr>
                ) : materials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Nenhum material encontrado
                    </td>
                  </tr>
                ) : (
                  materials.map((material) => (
                    <tr key={material.id} className="hover:bg-muted/50" data-testid={`row-material-${material.id}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                            {getMaterialIcon(material.tipoMaterial)}
                          </div>
                          <span className="font-medium text-card-foreground" data-testid={`text-material-type-${material.id}`}>
                            {material.tipoMaterial}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">{getDeliveryBadge(material.entrega)}</td>
                      <td className="p-4 text-card-foreground" data-testid={`text-material-target-${material.id}`}>
                        {material.destinatario}
                      </td>
                      <td className="p-4 text-card-foreground" data-testid={`text-material-quantity-${material.id}`}>
                        {material.quantidade}
                      </td>
                      <td className="p-4">{getStatusBadge(material.status)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Dialog open={editingMaterial?.id === material.id} onOpenChange={(open) => !open && setEditingMaterial(null)}>
                            <DialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                data-testid={`button-edit-material-${material.id}`}
                                onClick={() => setEditingMaterial(material)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Material</DialogTitle>
                              </DialogHeader>
                              <MaterialForm 
                                material={editingMaterial || undefined} 
                                onSuccess={() => setEditingMaterial(null)} 
                              />
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="icon"
                            variant="outline"
                            data-testid={`button-delete-material-${material.id}`}
                            onClick={() => handleDeleteMaterial(material.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Material Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <Card className="bg-card border-border p-8">
              <p className="text-center text-muted-foreground">Carregando materiais...</p>
            </Card>
          ) : materials.length === 0 ? (
            <Card className="bg-card border-border p-8">
              <p className="text-center text-muted-foreground">Nenhum material encontrado</p>
            </Card>
          ) : (
            materials.map((material) => (
              <Card key={material.id} className="bg-card border-border" data-testid={`card-material-${material.id}`}>
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                        {getMaterialIcon(material.tipoMaterial)}
                      </div>
                      <p className="font-semibold text-lg text-card-foreground truncate" data-testid={`text-material-type-${material.id}`}>
                        {material.tipoMaterial}
                      </p>
                    </div>
                    <p className="text-blue-500 font-semibold text-base flex-shrink-0" data-testid={`text-material-quantity-${material.id}`}>
                      {material.quantidade}x
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full">
                    <Dialog open={editingMaterial?.id === material.id} onOpenChange={(open) => !open && setEditingMaterial(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-edit-material-${material.id}`}
                          onClick={() => setEditingMaterial(material)}
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Material</DialogTitle>
                        </DialogHeader>
                        <MaterialForm 
                          material={editingMaterial || undefined} 
                          onSuccess={() => setEditingMaterial(null)} 
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-delete-material-${material.id}`}
                      onClick={() => handleDeleteMaterial(material.id)}
                      className="flex-1"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
