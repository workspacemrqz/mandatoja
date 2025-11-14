import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Search, Eye, ChevronLeft, ChevronRight, RefreshCw, Settings2, FileSpreadsheet, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleSelect, SimpleSelectContent, SimpleSelectTrigger, SimpleSelectValue } from "@/components/ui/simple-select";
import { ScrollableSelect, ScrollableSelectContent, ScrollableSelectTrigger, ScrollableSelectValue } from "@/components/ui/scrollable-select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { formatWhatsApp, formatWhatsAppWithoutCountry, copyPhoneToClipboard } from "@/lib/utils";
import VoterForm from "./voter-form.tsx";
import type { Voter, ConfigOption, CollectorAgent } from "@shared/schema";

// Helper function to get first name
const getFirstName = (fullName?: string | null) => fullName?.trim()?.split(/\s+/)?.[0] || '-';

export default function VotersTab() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  const [viewingVoter, setViewingVoter] = useState<Voter | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [municipioFilter, setMunicipioFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");
  const [votoFilter, setVotoFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: voters = [], isLoading } = useQuery<Voter[]>({
    queryKey: ['/api/voters'],
  });
  
  // Query to get collector agents
  const { data: collectorAgents = [] } = useQuery<CollectorAgent[]>({
    queryKey: ['/api/collector-agents'],
  });
  
  // Helper function to check if voter came from an active Collector Agent
  const isFromCollectorAgent = (voterIndicacao: string) => {
    return collectorAgents.some(agent => agent.isActive && agent.indicacao === voterIndicacao);
  };
  
  // Query to get configured municipios
  const { data: municipioOptions = [] } = useQuery<ConfigOption[]>({
    queryKey: ['/api/config-options/municipio'],
  });
  
  // Query to get configured bairros based on selected municipio
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

  // Process bairros to add municipality name when showing all
  const bairroOptions = rawBairroOptions.map(bairro => {
    // When showing all bairros and there's a parent município, add it to the label
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

  const deleteVoterMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/voters/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voters'] });
    },
    onError: () => {
    },
  });

  const syncContactsMutation = useMutation({
    mutationFn: () => apiRequest('/api/voters/sync-contacts', { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voters'] });
      setIsSyncDialogOpen(false);
    },
    onError: () => {
      setIsSyncDialogOpen(false);
    },
  });

  const exportExcelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/voters/export-excel');
      if (!response.ok) throw new Error('Erro ao exportar');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eleitores_${new Date().toISOString().split('T')[0]}.xlsx`;
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

  const filteredVoters = voters.filter(voter => {
    const matchesSearch = voter.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         voter.whatsapp.includes(searchTerm);
    const matchesMunicipio = !municipioFilter || municipioFilter === "all" || voter.municipio === municipioFilter;
    const matchesBairro = !bairroFilter || bairroFilter === "all" || voter.bairro === bairroFilter;
    const matchesVoto = !votoFilter || votoFilter === "all" || voter.voto === votoFilter;
    const matchesMaterial = !materialFilter || materialFilter === "all" || voter.material === materialFilter;
    
    return matchesSearch && matchesMunicipio && matchesBairro && matchesVoto && matchesMaterial;
  });


  // Pagination calculations
  const totalPages = Math.ceil(filteredVoters.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVoters = filteredVoters.slice(startIndex, endIndex);

  // Reset to first page when filters change
  const resetToFirstPage = () => setCurrentPage(1);
  
  // Update currentPage when filters change
  useEffect(() => {
    resetToFirstPage();
  }, [searchTerm, municipioFilter, bairroFilter, votoFilter, materialFilter]);

  const getVoteStatusBadge = (status: string) => {
    return status === 'confirmado' ? (
      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/10">Confirmado</Badge>
    ) : (
      <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/10">Em Progresso</Badge>
    );
  };

  const getMaterialStatusBadge = (status: string) => {
    switch (status) {
      case 'entregue':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/10">Entregue</Badge>;
      case 'enviado':
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/10">Enviado</Badge>;
      default:
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/10">Sem Material</Badge>;
    }
  };

  const handleDeleteVoter = (id: string) => {
    if (confirm("Tem certeza que deseja remover este eleitor?")) {
      deleteVoterMutation.mutate(id);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-3xl font-bold text-foreground">Eleitores</h2>
            <p className="text-muted-foreground mt-2">Gestão da base de eleitores</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  data-testid="button-funcionalidades" 
                  variant="outline"
                  disabled={syncContactsMutation.isPending || exportExcelMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  Funcionalidades
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  data-testid="menu-item-sync-contacts"
                  onClick={() => setIsSyncDialogOpen(true)}
                  disabled={syncContactsMutation.isPending}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Contatos
                </DropdownMenuItem>
                <DropdownMenuItem 
                  data-testid="menu-item-export-excel"
                  onClick={() => exportExcelMutation.mutate()}
                  disabled={exportExcelMutation.isPending}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sincronizar Nomes dos Contatos</DialogTitle>
                </DialogHeader>
                <p className="text-muted-foreground">
                  Isso vai atualizar os nomes dos eleitores usando os contatos salvos no WhatsApp. Deseja continuar?
                </p>
                <div className="flex justify-end gap-3 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsSyncDialogOpen(false)}
                    disabled={syncContactsMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => syncContactsMutation.mutate()}
                    disabled={syncContactsMutation.isPending}
                  >
                    Sincronizar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-voter" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Eleitor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Eleitor</DialogTitle>
                </DialogHeader>
                <VoterForm onSuccess={() => setIsAddModalOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="w-full">
                <label className="block text-sm font-medium text-card-foreground mb-2">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    data-testid="input-search-voters"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium text-card-foreground mb-2">Município</label>
                <SimpleSelect 
                  value={municipioFilter} 
                  onValueChange={(value) => {
                    setMunicipioFilter(value);
                    // Resetar filtro de bairro quando município mudar
                    setBairroFilter('all');
                  }}
                >
                  <SimpleSelectTrigger data-testid="select-municipio-filter" className="w-full">
                    <SimpleSelectValue placeholder="Todos os municípios" />
                  </SimpleSelectTrigger>
                  <SimpleSelectContent
                    items={[
                      { id: "all", value: "all", label: "Todos os municípios" },
                      ...municipioOptions
                    ]}
                    emptyMessage="Nenhum município encontrado"
                  />
                </SimpleSelect>
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium text-card-foreground mb-2">Bairro</label>
                <SimpleSelect value={bairroFilter} onValueChange={setBairroFilter}>
                  <SimpleSelectTrigger data-testid="select-bairro-filter" className="w-full">
                    <SimpleSelectValue placeholder="Todos os bairros" />
                  </SimpleSelectTrigger>
                  <SimpleSelectContent
                    items={[
                      { id: "all", value: "all", label: "Todos os bairros" },
                      ...bairroOptions.map(b => ({ id: b.id, value: b.value, label: b.label }))
                    ]}
                    emptyMessage="Nenhum bairro encontrado"
                  />
                </SimpleSelect>
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium text-card-foreground mb-2">Status do Voto</label>
                <ScrollableSelect value={votoFilter} onValueChange={setVotoFilter}>
                  <ScrollableSelectTrigger data-testid="select-vote-filter" className="w-full">
                    <ScrollableSelectValue placeholder="Todos" />
                  </ScrollableSelectTrigger>
                  <ScrollableSelectContent
                    items={[
                      { id: "all", value: "all", label: "Todos" },
                      { id: "confirmado", value: "confirmado", label: "Confirmado" },
                      { id: "em_progresso", value: "em_progresso", label: "Em Progresso" }
                    ]}
                    initialLoadCount={5}
                    loadMoreCount={5}
                    emptyMessage="Nenhuma opção encontrada"
                  />
                </ScrollableSelect>
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium text-card-foreground mb-2">Material</label>
                <ScrollableSelect value={materialFilter} onValueChange={setMaterialFilter}>
                  <ScrollableSelectTrigger data-testid="select-material-filter" className="w-full">
                    <ScrollableSelectValue placeholder="Todos" />
                  </ScrollableSelectTrigger>
                  <ScrollableSelectContent
                    items={[
                      { id: "all", value: "all", label: "Todos" },
                      { id: "entregue", value: "entregue", label: "Entregue" },
                      { id: "enviado", value: "enviado", label: "Enviado" },
                      { id: "sem_material", value: "sem_material", label: "Sem Material" }
                    ]}
                    initialLoadCount={5}
                    loadMoreCount={5}
                    emptyMessage="Nenhuma opção encontrada"
                  />
                </ScrollableSelect>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voters Table - Desktop */}
        <Card className="hidden md:block bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Nome</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">WhatsApp</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Voto</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Material</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Município</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Bairro</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Indicação</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Carregando eleitores...
                    </td>
                  </tr>
                ) : filteredVoters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Nenhum eleitor encontrado
                    </td>
                  </tr>
                ) : (
                  paginatedVoters.map((voter) => (
                    <tr key={voter.id} className="hover:bg-muted/50" data-testid={`row-voter-${voter.id}`}>
                      <td className="p-4">
                        <span className="font-medium text-card-foreground" data-testid={`text-voter-name-${voter.id}`}>
                          {getFirstName(voter.nome)}
                        </span>
                      </td>
                      <td 
                        className="p-4 text-primary cursor-pointer hover:text-primary/80 transition-colors" 
                        data-testid={`text-voter-whatsapp-${voter.id}`}
                        onClick={() => copyPhoneToClipboard(voter.whatsapp)}
                        title="Clique para copiar"
                      >
                        {formatWhatsAppWithoutCountry(voter.whatsapp)}
                      </td>
                      <td className="p-4">{getVoteStatusBadge(voter.voto)}</td>
                      <td className="p-4">{getMaterialStatusBadge(voter.material)}</td>
                      <td className="p-4 text-card-foreground" data-testid={`text-voter-municipio-${voter.id}`}>
                        {voter.municipio}
                      </td>
                      <td className="p-4 text-card-foreground" data-testid={`text-voter-bairro-${voter.id}`}>
                        {voter.bairro}
                      </td>
                      <td className="p-4" data-testid={`text-voter-indicacao-${voter.id}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-card-foreground">{voter.indicacao}</span>
                          {isFromCollectorAgent(voter.indicacao) && (
                            <Bot className="w-5 h-5 text-primary" data-testid={`icon-collector-agent-${voter.id}`} />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Dialog open={viewingVoter?.id === voter.id} onOpenChange={(open) => !open && setViewingVoter(null)}>
                            <DialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                data-testid={`button-view-voter-${voter.id}`}
                                onClick={() => setViewingVoter(voter)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Informações do Eleitor</DialogTitle>
                              </DialogHeader>
                              {viewingVoter && (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3 pb-4 border-b">
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                      <span className="text-lg font-medium text-primary">
                                        {viewingVoter.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                      </span>
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-lg">{viewingVoter.nome}</h3>
                                      <p className="text-muted-foreground">{formatWhatsApp(viewingVoter.whatsapp)}</p>
                                    </div>
                                  </div>
                                  <div className="grid gap-3">
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Status do Voto</label>
                                      <div className="mt-1">
                                        {getVoteStatusBadge(viewingVoter.voto)}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Material</label>
                                      <div className="mt-1">
                                        {getMaterialStatusBadge(viewingVoter.material)}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Município</label>
                                      <p className="mt-1 text-foreground">{viewingVoter.municipio}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Bairro</label>
                                      <p className="mt-1 text-foreground">{viewingVoter.bairro}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Indicação</label>
                                      <p className="mt-1 text-foreground">{viewingVoter.indicacao}</p>
                                    </div>
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
                          <Dialog open={editingVoter?.id === voter.id} onOpenChange={(open) => !open && setEditingVoter(null)}>
                            <DialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                data-testid={`button-edit-voter-${voter.id}`}
                                onClick={() => setEditingVoter(voter)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Eleitor</DialogTitle>
                              </DialogHeader>
                              <VoterForm 
                                voter={editingVoter || undefined} 
                                onSuccess={() => setEditingVoter(null)} 
                              />
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="icon"
                            variant="outline"
                            data-testid={`button-delete-voter-${voter.id}`}
                            onClick={() => handleDeleteVoter(voter.id)}
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
          <div className="border-t border-border px-4 py-3">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="text-sm text-muted-foreground text-center">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredVoters.length)} de {filteredVoters.length} eleitores
              </div>
              {totalPages > 1 && (
                <div className="flex flex-row items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-previous-page"
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
                        data-testid={`button-page-${page}`}
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
                    data-testid="button-next-page"
                    className="h-8"
                  >
                    <span className="hidden sm:inline">Próximo</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Voters Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <Card className="bg-card border-border p-8">
              <p className="text-center text-muted-foreground">Carregando eleitores...</p>
            </Card>
          ) : filteredVoters.length === 0 ? (
            <Card className="bg-card border-border p-8">
              <p className="text-center text-muted-foreground">Nenhum eleitor encontrado</p>
            </Card>
          ) : (
            <>
              {paginatedVoters.map((voter) => (
                <Card key={voter.id} className="bg-card border-border" data-testid={`card-voter-${voter.id}`}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-lg text-card-foreground" data-testid={`text-voter-name-${voter.id}`}>
                        {voter.nome.split(' ')[0]}
                      </p>
                      <p 
                        className="p-4 text-primary cursor-pointer hover:text-primary/80 transition-colors" 
                        data-testid={`text-voter-whatsapp-${voter.id}`}
                        onClick={() => copyPhoneToClipboard(voter.whatsapp)}
                        title="Clique para copiar"
                      >
                        {formatWhatsAppWithoutCountry(voter.whatsapp)}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-evenly gap-2 w-full">
                      <Dialog open={viewingVoter?.id === voter.id} onOpenChange={(open) => !open && setViewingVoter(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-view-voter-${voter.id}`}
                            onClick={() => setViewingVoter(voter)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Informações do Eleitor</DialogTitle>
                          </DialogHeader>
                          {viewingVoter && (
                            <div className="space-y-4">
                              <div className="pb-4 border-b">
                                <h3 className="font-semibold text-lg">{viewingVoter.nome}</h3>
                                <p className="text-muted-foreground">{formatWhatsApp(viewingVoter.whatsapp)}</p>
                              </div>
                              <div className="grid gap-3">
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Status do Voto</label>
                                  <div className="mt-1">
                                    {getVoteStatusBadge(viewingVoter.voto)}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Material</label>
                                  <div className="mt-1">
                                    {getMaterialStatusBadge(viewingVoter.material)}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Município</label>
                                  <p className="mt-1 text-foreground">{viewingVoter.municipio}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Bairro</label>
                                  <p className="mt-1 text-foreground">{viewingVoter.bairro}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Indicação</label>
                                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                                    <span className="text-foreground">{viewingVoter.indicacao}</span>
                                    {isFromCollectorAgent(viewingVoter.indicacao) && (
                                      <Bot className="w-5 h-5 text-blue-500" data-testid="icon-collector-agent-detail" />
                                    )}
                                  </div>
                                </div>
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
                      <Dialog open={editingVoter?.id === voter.id} onOpenChange={(open) => !open && setEditingVoter(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-edit-voter-${voter.id}`}
                            onClick={() => setEditingVoter(voter)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Eleitor</DialogTitle>
                          </DialogHeader>
                          <VoterForm 
                            voter={editingVoter || undefined} 
                            onSuccess={() => setEditingVoter(null)} 
                          />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-delete-voter-${voter.id}`}
                        onClick={() => handleDeleteVoter(voter.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Pagination - Mobile */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="text-sm text-muted-foreground text-center">
                      Mostrando {startIndex + 1} a {Math.min(endIndex, filteredVoters.length)} de {filteredVoters.length} eleitores
                    </div>
                    {totalPages > 1 && (
                      <div className="flex flex-row items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          data-testid="button-previous-page-mobile"
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
                              data-testid={`button-page-mobile-${page}`}
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
                          data-testid="button-next-page-mobile"
                          className="h-8"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
