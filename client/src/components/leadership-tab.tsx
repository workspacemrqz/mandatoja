import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Search, Eye, ChevronLeft, ChevronRight, Settings2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollableSelect, ScrollableSelectContent, ScrollableSelectTrigger, ScrollableSelectValue } from "@/components/ui/scrollable-select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { formatWhatsApp, formatWhatsAppWithoutCountry, copyPhoneToClipboard } from "@/lib/utils";
import LeadershipForm from "./leadership-form.tsx";
import type { Leadership, Assessor, ConfigOption } from "@shared/schema";

// Helper function to get first name
const getFirstName = (fullName?: string | null) => fullName?.trim()?.split(/\s+/)?.[0] || '-';

type TabType = 'leadership' | 'assessor';

interface TabContentProps {
  type: TabType;
}

function TeamTabContent({ type }: TabContentProps) {
  const [editingItem, setEditingItem] = useState<Leadership | Assessor | null>(null);
  const [viewingItem, setViewingItem] = useState<Leadership | Assessor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [municipioFilter, setMunicipioFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const apiEndpoint = type === 'leadership' ? '/api/leaderships' : '/api/assessores';
  const entityLabel = type === 'leadership' ? 'Liderança' : 'Assessor';
  const entityPluralLabel = type === 'leadership' ? 'lideranças' : 'assessores';

  const { data: items = [], isLoading } = useQuery<Leadership[] | Assessor[]>({
    queryKey: [apiEndpoint],
  });
  
  const { data: municipioOptions = [] } = useQuery<ConfigOption[]>({
    queryKey: ['/api/config-options/municipio'],
  });
  
  const { data: rawBairroOptions = [] } = useQuery<ConfigOption[]>({
    queryKey: ['/api/config-options/bairro', municipioFilter],
    queryFn: municipioFilter !== "all" 
      ? async () => {
          const response = await fetch(`/api/config-options/bairro?municipio=${encodeURIComponent(municipioFilter)}`);
          if (!response.ok) throw new Error('Failed to fetch bairro options');
          return response.json();
        }
      : async () => {
          const response = await fetch('/api/config-options/bairro');
          if (!response.ok) throw new Error('Failed to fetch bairro options');
          return response.json();
        },
    enabled: true,
  });

  const bairroOptions = rawBairroOptions.map(bairro => {
    if (municipioFilter === "all" && bairro.parentMunicipio) {
      return {
        ...bairro,
        label: `${bairro.value} (${bairro.parentMunicipio})`
      };
    }
    return {
      ...bairro,
      label: bairro.value
    };
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${apiEndpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
    },
    onError: () => {
    },
  });

  const filteredItems = items.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.whatsapp.includes(searchTerm);
    const matchesMunicipio = !municipioFilter || municipioFilter === "all" || item.municipio === municipioFilter;
    const matchesBairro = !bairroFilter || bairroFilter === "all" || item.bairro === bairroFilter;
    
    return matchesSearch && matchesMunicipio && matchesBairro;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const resetToFirstPage = () => setCurrentPage(1);
  
  useEffect(() => {
    resetToFirstPage();
  }, [searchTerm, municipioFilter, bairroFilter]);

  const handleDelete = (id: string) => {
    if (confirm(`Tem certeza que deseja remover este ${entityLabel.toLowerCase()}?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div>
      {/* Filters */}
      <Card className="bg-card border-border mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  data-testid={`input-search-${type}s`}
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">Município</label>
              <ScrollableSelect 
                value={municipioFilter} 
                onValueChange={(value) => {
                  setMunicipioFilter(value);
                  setBairroFilter('all');
                }}
              >
                <ScrollableSelectTrigger data-testid={`select-municipio-filter-${type}`}>
                  <ScrollableSelectValue placeholder="Todos os municípios" />
                </ScrollableSelectTrigger>
                <ScrollableSelectContent
                  items={[
                    { id: "all", value: "all", label: "Todos os municípios" },
                    ...municipioOptions
                  ]}
                  initialLoadCount={5}
                  loadMoreCount={5}
                  emptyMessage="Nenhum município encontrado"
                />
              </ScrollableSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">Bairro</label>
              <ScrollableSelect value={bairroFilter} onValueChange={setBairroFilter}>
                <ScrollableSelectTrigger data-testid={`select-bairro-filter-${type}`}>
                  <ScrollableSelectValue placeholder="Todos os bairros" />
                </ScrollableSelectTrigger>
                <ScrollableSelectContent
                  items={[
                    { id: "all", value: "all", label: "Todos os bairros" },
                    ...bairroOptions.map(b => ({ id: b.id, value: b.value, label: b.label }))
                  ]}
                  initialLoadCount={5}
                  loadMoreCount={5}
                  emptyMessage="Nenhum bairro encontrado"
                />
              </ScrollableSelect>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Carregando {entityPluralLabel}...</p>
          </CardContent>
        </Card>
      )}

      {/* Data Table - Desktop */}
      {!isLoading && (
        <Card className="hidden md:block bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Nome</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">WhatsApp</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Município</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Bairro</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.length === 0 && filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8">
                      <p className="text-muted-foreground">Nenhum {entityLabel.toLowerCase()} encontrado</p>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8">
                      <p className="text-muted-foreground">Nenhum {entityLabel.toLowerCase()} nesta página</p>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-muted/50"
                      data-testid={`row-${type}-${item.id}`}
                    >
                      <td className="p-4">
                        <span className="font-medium text-card-foreground" data-testid={`text-${type}-name-${item.id}`}>
                          {getFirstName(item.nome)}
                        </span>
                      </td>
                      <td 
                        className="p-4 text-primary cursor-pointer hover:text-primary/80 transition-colors" 
                        data-testid={`text-${type}-whatsapp-${item.id}`}
                        onClick={() => copyPhoneToClipboard(item.whatsapp)}
                        title="Clique para copiar"
                      >
                        {formatWhatsAppWithoutCountry(item.whatsapp)}
                      </td>
                      <td className="p-4 text-card-foreground" data-testid={`text-${type}-municipality-${item.id}`}>
                        {item.municipio}
                      </td>
                      <td className="p-4 text-card-foreground" data-testid={`text-${type}-neighborhood-${item.id}`}>
                        {item.bairro}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Dialog open={viewingItem?.id === item.id} onOpenChange={(open) => !open && setViewingItem(null)}>
                            <DialogTrigger asChild>
                              <Button
                                data-testid={`button-view-${type}-${item.id}`}
                                size="icon"
                                variant="outline"
                                onClick={() => setViewingItem(item)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Detalhes do {entityLabel}</DialogTitle>
                              </DialogHeader>
                              {viewingItem && (
                                <div className="space-y-4">
                                  <div>
                                    <p className="font-semibold">Nome:</p>
                                    <p>{viewingItem.nome}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">WhatsApp:</p>
                                    <p>{formatWhatsApp(viewingItem.whatsapp)}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Município:</p>
                                    <p>{viewingItem.municipio}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Bairro:</p>
                                    <p>{viewingItem.bairro}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Anotações:</p>
                                    <p>{viewingItem.anotacoes || "Nenhuma anotação"}</p>
                                  </div>
                                  <div className="flex justify-end mt-4">
                                    <DialogClose asChild>
                                      <Button variant="outline">
                                        Fechar
                                      </Button>
                                    </DialogClose>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>

                          <Dialog open={editingItem?.id === item.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                            <DialogTrigger asChild>
                              <Button
                                data-testid={`button-edit-${type}-${item.id}`}
                                size="icon"
                                variant="outline"
                                onClick={() => setEditingItem(item)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar {entityLabel}</DialogTitle>
                              </DialogHeader>
                              <LeadershipForm 
                                type={type}
                                leadership={editingItem || undefined} 
                                onSuccess={() => setEditingItem(null)} 
                              />
                            </DialogContent>
                          </Dialog>

                          <Button
                            data-testid={`button-delete-${type}-${item.id}`}
                            size="icon"
                            variant="outline"
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteMutation.isPending}
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
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-border px-4 py-3">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="text-sm text-muted-foreground text-center">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, filteredItems.length)} de {filteredItems.length} {entityPluralLabel}
                </div>
                <div className="flex flex-row items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    data-testid={`button-previous-page-${type}`}
                    className="h-8"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        data-testid={`button-page-${page}-${type}`}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    data-testid={`button-next-page-${type}`}
                    className="h-8"
                  >
                    <span className="hidden sm:inline">Próximo</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Mobile Cards */}
      {!isLoading && (
        <div className="md:hidden space-y-3">
          {paginatedItems.length === 0 && filteredItems.length === 0 ? (
            <Card className="bg-card border-border p-8">
              <p className="text-center text-muted-foreground">Nenhum {entityLabel.toLowerCase()} encontrado</p>
            </Card>
          ) : paginatedItems.length === 0 ? (
            <Card className="bg-card border-border p-8">
              <p className="text-center text-muted-foreground">Nenhum {entityLabel.toLowerCase()} nesta página</p>
            </Card>
          ) : (
            <>
              {paginatedItems.map((item) => (
                <Card key={item.id} className="bg-card border-border" data-testid={`card-${type}-${item.id}`}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-lg text-card-foreground" data-testid={`text-${type}-name-${item.id}`}>
                        {item.nome.split(' ')[0]}
                      </p>
                      <p 
                        className="text-primary cursor-pointer hover:text-primary/80 transition-colors" 
                        data-testid={`text-${type}-whatsapp-${item.id}`}
                        onClick={() => copyPhoneToClipboard(item.whatsapp)}
                        title="Clique para copiar"
                      >
                        {formatWhatsAppWithoutCountry(item.whatsapp)}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-evenly gap-2 w-full">
                      <Dialog open={viewingItem?.id === item.id} onOpenChange={(open) => !open && setViewingItem(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-view-${type}-${item.id}`}
                            onClick={() => setViewingItem(item)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Detalhes do {entityLabel}</DialogTitle>
                          </DialogHeader>
                          {viewingItem && (
                            <div className="space-y-4">
                              <div>
                                <p className="font-semibold">Nome:</p>
                                <p>{viewingItem.nome}</p>
                              </div>
                              <div>
                                <p className="font-semibold">WhatsApp:</p>
                                <p>{formatWhatsApp(viewingItem.whatsapp)}</p>
                              </div>
                              <div>
                                <p className="font-semibold">Município:</p>
                                <p>{viewingItem.municipio}</p>
                              </div>
                              <div>
                                <p className="font-semibold">Bairro:</p>
                                <p>{viewingItem.bairro}</p>
                              </div>
                              <div>
                                <p className="font-semibold">Anotações:</p>
                                <p>{viewingItem.anotacoes || "Nenhuma anotação"}</p>
                              </div>
                              <div className="flex justify-end mt-4">
                                <DialogClose asChild>
                                  <Button variant="outline">
                                    Fechar
                                  </Button>
                                </DialogClose>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      <Dialog open={editingItem?.id === item.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-edit-${type}-${item.id}`}
                            onClick={() => setEditingItem(item)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar {entityLabel}</DialogTitle>
                          </DialogHeader>
                          <LeadershipForm 
                            type={type}
                            leadership={editingItem || undefined} 
                            onSuccess={() => setEditingItem(null)} 
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-delete-${type}-${item.id}`}
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Pagination - Mobile */}
              {totalPages > 1 && (
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="text-sm text-muted-foreground text-center">
                        Mostrando {startIndex + 1} a {Math.min(endIndex, filteredItems.length)} de {filteredItems.length} {entityPluralLabel}
                      </div>
                      <div className="flex flex-row items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          data-testid={`button-previous-page-mobile-${type}`}
                          className="h-8"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              data-testid={`button-page-mobile-${page}-${type}`}
                              className="w-8 h-8 p-0"
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          data-testid={`button-next-page-mobile-${type}`}
                          className="h-8"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeadershipTab() {
  const [activeTab, setActiveTab] = useState<TabType>('leadership');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const entityLabel = activeTab === 'leadership' ? 'Liderança' : 'Assessor';
  const apiEndpoint = activeTab === 'leadership' ? '/api/leaderships/export-excel' : '/api/assessores/export-excel';
  const fileName = activeTab === 'leadership' ? 'liderancas' : 'assessores';

  const exportExcelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) throw new Error('Erro ao exportar');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Equipe</h2>
          <p className="text-muted-foreground mt-2">Gestão da base de lideranças e assessores</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="leadership" className="w-full" onValueChange={(value) => setActiveTab(value as TabType)}>
          {/* Tabs Header with Add Button */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
            <TabsList className="hidden md:grid w-full grid-cols-2 bg-[#090909] rounded-lg border border-border h-auto p-1 items-center">
              <TabsTrigger value="leadership" data-testid="tab-trigger-leadership" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Lideranças
              </TabsTrigger>
              <TabsTrigger value="assessor" data-testid="tab-trigger-assessor" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Assessores
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    data-testid="button-funcionalidades-equipe" 
                    variant="outline"
                    disabled={exportExcelMutation.isPending}
                    className="w-full sm:w-auto lg:w-auto"
                  >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Funcionalidades
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    data-testid="menu-item-export-excel-equipe"
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
                  <Button data-testid={`button-add-${activeTab}`} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto lg:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar {entityLabel}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar {entityLabel}</DialogTitle>
                  </DialogHeader>
                  <LeadershipForm
                    type={activeTab}
                    onSuccess={() => setIsAddModalOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <TabsContent value="leadership">
            <TeamTabContent type="leadership" />
          </TabsContent>

          <TabsContent value="assessor">
            <TeamTabContent type="assessor" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
