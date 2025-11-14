import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Edit, Trash2, Eye, ChevronLeft, ChevronRight, Calendar, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { formatWhatsApp, formatWhatsAppWithoutCountry, copyPhoneToClipboard } from "@/lib/utils";
import type { CloneAgentMessageQueue, MessagesQueue, MilitantMessageQueue } from "@shared/schema";

// Helper function to get first name
const getFirstName = (fullName?: string | null) => fullName?.trim()?.split(/\s+/)?.[0] || '-';

type TabType = 'clone' | 'militant';

interface CloneTabContentProps {
  type: 'clone';
}

interface MilitantTabContentProps {
  type: 'militant';
}

type TabContentProps = CloneTabContentProps | MilitantTabContentProps;

function formatDate(date: Date | string): string {
  // Garante que a data seja interpretada corretamente
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Formata usando o timezone de São Paulo
  const formatted = d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Sao_Paulo',
    hour12: false
  });
  
  return formatted;
}

// Formata o JSON de mensagens do clone agent para exibição
function formatCloneMessages(messagesJson: string): string {
  try {
    const messages = JSON.parse(messagesJson);
    if (!Array.isArray(messages) || messages.length === 0) {
      return "Sem mensagens";
    }
    
    // Formata cada mensagem como "Nome: Conteúdo"
    return messages
      .map((msg: any) => {
        const name = msg.senderName || "Desconhecido";
        const content = msg.content || "";
        return `${name}: ${content}`;
      })
      .join('\n');
  } catch (error) {
    // Se não for JSON válido, retorna o texto original
    return messagesJson;
  }
}

// Exibe a resposta gerada do agente ou as mensagens do eleitor se ainda não processado
function getDisplayMessage(cloneItem: CloneAgentMessageQueue): string {
  // Se já foi processada e tem resposta gerada, exibe a resposta
  if (cloneItem.generatedResponse) {
    return cloneItem.generatedResponse;
  }
  // Senão, exibe as mensagens coletadas do eleitor
  return formatCloneMessages(cloneItem.messages);
}

// Formata o JSON de mensagens do militant agent para exibição
function formatMilitantMessages(messagesJson: string): string {
  try {
    const messages = JSON.parse(messagesJson);
    if (!Array.isArray(messages) || messages.length === 0) {
      return "Sem mensagens";
    }
    
    // Formata cada mensagem como "Nome: Conteúdo"
    return messages
      .map((msg: any) => {
        const name = msg.pushName || msg.fromName || "Desconhecido";
        const content = msg.body || msg.message || "";
        return `${name}: ${content}`;
      })
      .join('\n');
  } catch (error) {
    // Se não for JSON válido, retorna o texto original
    return messagesJson;
  }
}

// Exibe a resposta gerada do agente militante ou as mensagens coletadas se ainda não processado
function getMilitantDisplayMessage(militantItem: MilitantMessageQueue): string {
  // Se já foi processada e tem resposta gerada, exibe a resposta
  if (militantItem.generatedResponse) {
    return militantItem.generatedResponse;
  }
  // Senão, exibe as mensagens coletadas
  return formatMilitantMessages(militantItem.messages);
}


function SchedulingsTabContent({ type }: TabContentProps) {
  const [editingItem, setEditingItem] = useState<CloneAgentMessageQueue | MilitantMessageQueue | null>(null);
  const [viewingItem, setViewingItem] = useState<CloneAgentMessageQueue | MilitantMessageQueue | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editedMessage, setEditedMessage] = useState("");
  const itemsPerPage = 10;

  const apiEndpoint = type === 'clone' ? '/api/scheduled-messages/clone' : '/api/scheduled-messages/militant';
  const entityLabel = type === 'clone' ? 'Agente Clone' : 'Agente Militante';

  const { data: items = [], isLoading } = useQuery<CloneAgentMessageQueue[] | MilitantMessageQueue[]>({
    queryKey: [apiEndpoint],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${apiEndpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
    },
    onError: () => {
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`${apiEndpoint}/${id}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      setEditingItem(null);
    },
    onError: () => {
    },
  });

  const sendManualMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/scheduled-messages/clone/${id}/send-now`, { 
        method: 'POST'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      setViewingItem(null);
    },
    onError: () => {
    },
  });

  const handleSendNow = (id: string) => {
    if (confirm("Tem certeza que deseja enviar esta mensagem agora?")) {
      sendManualMutation.mutate(id);
    }
  };

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = items.slice(startIndex, endIndex);

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover esta mensagem agendada?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (item: CloneAgentMessageQueue | MilitantMessageQueue) => {
    setEditingItem(item);
    if (type === 'clone') {
      const cloneItem = item as CloneAgentMessageQueue;
      setEditedMessage(getDisplayMessage(cloneItem));
    } else {
      const militantItem = item as MilitantMessageQueue;
      setEditedMessage(militantItem.generatedResponse || '');
    }
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;

    if (type === 'clone') {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          generatedResponse: editedMessage
        }
      });
    } else {
      // Para agente militante, atualiza a resposta gerada
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          generatedResponse: editedMessage
        }
      });
    }
  };

  return (
    <div>
      {/* Loading State */}
      {isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Carregando mensagens agendadas...</p>
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
                  {type === 'clone' ? (
                    <>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Eleitor</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">WhatsApp</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Mensagem</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Agendado para</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Grupo</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Remetente</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Mensagem</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Recebida em</th>
                    </>
                  )}
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.length === 0 && items.length === 0 ? (
                  <tr>
                    <td colSpan={type === 'clone' ? 5 : 5} className="text-center p-8">
                      <p className="text-muted-foreground">Nenhuma mensagem agendada</p>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={type === 'clone' ? 5 : 5} className="text-center p-8">
                      <p className="text-muted-foreground">Nenhuma mensagem nesta página</p>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    if (type === 'clone') {
                      const cloneItem = item as CloneAgentMessageQueue;
                      return (
                        <tr 
                          key={cloneItem.id} 
                          className="hover:bg-muted/50"
                          data-testid={`row-clone-${cloneItem.id}`}
                        >
                          <td className="p-4">
                            <span className="font-medium text-card-foreground" data-testid={`text-clone-name-${cloneItem.id}`}>
                              {getFirstName((cloneItem as any).voterName || '-')}
                            </span>
                          </td>
                          <td 
                            className="p-4 text-primary cursor-pointer hover:text-primary/80 transition-colors" 
                            data-testid={`text-clone-phone-${cloneItem.id}`}
                            onClick={() => copyPhoneToClipboard(cloneItem.phoneNumber)}
                            title="Clique para copiar"
                          >
                            {formatWhatsAppWithoutCountry(cloneItem.phoneNumber)}
                          </td>
                          <td className="p-4">
                            <div className="max-w-xs truncate text-card-foreground" data-testid={`text-clone-message-${cloneItem.id}`}>
                              {getDisplayMessage(cloneItem)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="text-card-foreground" data-testid={`text-clone-date-${cloneItem.id}`}>
                                {formatDate(cloneItem.scheduledSendTime || cloneItem.collectionEndTime)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Dialog open={viewingItem?.id === cloneItem.id} onOpenChange={(open) => !open && setViewingItem(null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    data-testid={`button-view-clone-${cloneItem.id}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingItem(cloneItem)}
                                    className="text-blue-500 hover:text-blue-500/80 p-1"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Detalhes da Mensagem Agendada</DialogTitle>
                                  </DialogHeader>
                                  {viewingItem && (
                                    <div className="space-y-4">
                                      <div>
                                        <p className="font-semibold">WhatsApp:</p>
                                        <p>{formatWhatsApp((viewingItem as CloneAgentMessageQueue).phoneNumber)}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold">Mensagem:</p>
                                        <p className="whitespace-pre-wrap">{getDisplayMessage(viewingItem as CloneAgentMessageQueue)}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold">Agendado para:</p>
                                        <p>{formatDate((viewingItem as CloneAgentMessageQueue).scheduledSendTime || (viewingItem as CloneAgentMessageQueue).collectionEndTime)}</p>
                                      </div>
                                      <div className="flex justify-end gap-2 mt-4">
                                        <Button 
                                          onClick={() => handleSendNow(viewingItem.id)}
                                          disabled={sendManualMutation.isPending}
                                          data-testid={`button-send-now-${viewingItem.id}`}
                                        >
                                          {sendManualMutation.isPending ? "Enviando..." : "Enviar"}
                                        </Button>
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

                              <Dialog open={editingItem?.id === cloneItem.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    data-testid={`button-edit-clone-${cloneItem.id}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(cloneItem)}
                                    title="Editar mensagem"
                                    className="text-primary hover:text-primary/80 p-1"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Editar Mensagem</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <Label>WhatsApp</Label>
                                      <Input value={formatWhatsApp(cloneItem.phoneNumber)} disabled />
                                    </div>
                                    <div>
                                      <Label>Mensagem</Label>
                                      <Textarea
                                        data-testid="textarea-edit-message"
                                        value={editedMessage}
                                        onChange={(e) => setEditedMessage(e.target.value)}
                                        rows={4}
                                        placeholder="Digite a mensagem que será enviada..."
                                      />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Edite a mensagem que será enviada ao eleitor.
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => setEditingItem(null)}
                                        className="flex-1"
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        data-testid="button-save-edit"
                                        onClick={handleSaveEdit}
                                        disabled={updateMutation.isPending}
                                        className="flex-1"
                                      >
                                        {updateMutation.isPending ? "Salvando..." : "Salvar"}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              <Button
                                data-testid={`button-delete-clone-${cloneItem.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(cloneItem.id)}
                                disabled={deleteMutation.isPending}
                                className="text-destructive hover:text-destructive/80 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    } else {
                      const militantItem = item as MilitantMessageQueue;
                      return (
                        <tr 
                          key={militantItem.id} 
                          className="hover:bg-muted/50"
                          data-testid={`row-militant-${militantItem.id}`}
                        >
                          <td className="p-4">
                            <span className="font-medium text-card-foreground" data-testid={`text-militant-group-${militantItem.id}`}>
                              {militantItem.groupName || 'Grupo'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div>
                              <div className="font-medium text-card-foreground" data-testid={`text-militant-status-${militantItem.id}`}>
                                {militantItem.status === 'collecting' && '📝 Coletando'}
                                {militantItem.status === 'ready' && '⏳ Pronto'}
                                {militantItem.status === 'processing' && '⚙️ Processando'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ID: {militantItem.groupId.substring(0, 20)}...
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="max-w-xs truncate text-card-foreground" data-testid={`text-militant-message-${militantItem.id}`}>
                              {getMilitantDisplayMessage(militantItem)}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-card-foreground" data-testid={`text-militant-date-${militantItem.id}`}>
                              {formatDate(militantItem.collectionEndTime)}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Dialog open={viewingItem?.id === militantItem.id} onOpenChange={(open) => !open && setViewingItem(null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    data-testid={`button-view-militant-${militantItem.id}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingItem(militantItem)}
                                    className="text-blue-500 hover:text-blue-500/80 p-1"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Detalhes da Fila do Agente Militante</DialogTitle>
                                  </DialogHeader>
                                  {viewingItem && (
                                    <div className="space-y-4">
                                      <div>
                                        <p className="font-semibold">Grupo:</p>
                                        <p>{(viewingItem as MilitantMessageQueue).groupName || 'Sem nome'}</p>
                                        <p className="text-xs text-muted-foreground">{(viewingItem as MilitantMessageQueue).groupId}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold">Status:</p>
                                        <p>
                                          {(viewingItem as MilitantMessageQueue).status === 'collecting' && '📝 Coletando mensagens'}
                                          {(viewingItem as MilitantMessageQueue).status === 'ready' && '⏳ Pronto para processar'}
                                          {(viewingItem as MilitantMessageQueue).status === 'processing' && '⚙️ Processando'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-semibold">Mensagens Coletadas:</p>
                                        <div className="bg-muted p-3 rounded-md max-h-60 overflow-y-auto">
                                          <p className="whitespace-pre-wrap text-sm">{formatMilitantMessages((viewingItem as MilitantMessageQueue).messages)}</p>
                                        </div>
                                      </div>
                                      {(viewingItem as MilitantMessageQueue).generatedResponse && (
                                        <div>
                                          <p className="font-semibold">Resposta Gerada:</p>
                                          <div className="bg-primary/10 p-3 rounded-md">
                                            <p className="whitespace-pre-wrap text-sm">{(viewingItem as MilitantMessageQueue).generatedResponse}</p>
                                          </div>
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-semibold">Fim da Coleta:</p>
                                        <p>{formatDate((viewingItem as MilitantMessageQueue).collectionEndTime)}</p>
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

                              <Dialog open={editingItem?.id === militantItem.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    data-testid={`button-edit-militant-${militantItem.id}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(militantItem)}
                                    className="text-primary hover:text-primary/80 p-1"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Editar Resposta do Agente Militante</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <Label>Grupo</Label>
                                      <Input value={militantItem.groupName || 'Sem nome'} disabled />
                                      <p className="text-xs text-muted-foreground mt-1">{militantItem.groupId}</p>
                                    </div>
                                    <div>
                                      <Label>Mensagens Coletadas</Label>
                                      <div className="bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
                                        <p className="text-sm whitespace-pre-wrap">{formatMilitantMessages(militantItem.messages)}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <Label>Resposta a Enviar</Label>
                                      <Textarea
                                        data-testid="textarea-edit-message"
                                        value={editedMessage}
                                        onChange={(e) => setEditedMessage(e.target.value)}
                                        rows={6}
                                        placeholder="Digite a resposta que o agente militante enviará ao grupo..."
                                      />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Edite a resposta que será enviada pelo agente ao grupo do WhatsApp.
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => setEditingItem(null)}
                                        className="flex-1"
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        data-testid="button-save-edit"
                                        onClick={handleSaveEdit}
                                        disabled={updateMutation.isPending}
                                        className="flex-1"
                                      >
                                        {updateMutation.isPending ? "Salvando..." : "Salvar"}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              <Button
                                data-testid={`button-delete-militant-${militantItem.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(militantItem.id)}
                                disabled={deleteMutation.isPending}
                                className="text-destructive hover:text-destructive/80 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-border px-4 py-3">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="text-sm text-muted-foreground text-center">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, items.length)} de {items.length} mensagens
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
          {paginatedItems.length === 0 && items.length === 0 ? (
            <Card className="bg-card border-border p-8">
              <p className="text-center text-muted-foreground">Nenhuma mensagem agendada</p>
            </Card>
          ) : paginatedItems.length === 0 ? (
            <Card className="bg-card border-border p-8">
              <p className="text-center text-muted-foreground">Nenhuma mensagem nesta página</p>
            </Card>
          ) : (
            <>
              {paginatedItems.map((item) => {
                if (type === 'clone') {
                  const cloneItem = item as CloneAgentMessageQueue;
                  return (
                    <Card key={cloneItem.id} className="bg-card border-border" data-testid={`card-clone-${cloneItem.id}`}>
                      <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-base text-card-foreground" data-testid={`text-clone-name-${cloneItem.id}`}>
                            {(cloneItem as any).voterName?.split(' ')[0] || '-'}
                          </p>
                          <p 
                            className="text-primary cursor-pointer hover:text-primary/80 transition-colors text-sm" 
                            data-testid={`text-clone-phone-${cloneItem.id}`}
                            onClick={() => copyPhoneToClipboard(cloneItem.phoneNumber)}
                            title="Clique para copiar"
                          >
                            {formatWhatsAppWithoutCountry(cloneItem.phoneNumber)}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-evenly gap-2 w-full">
                          <Dialog open={viewingItem?.id === cloneItem.id} onOpenChange={(open) => !open && setViewingItem(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-view-clone-${cloneItem.id}`}
                                onClick={() => setViewingItem(cloneItem)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Detalhes da Mensagem Agendada</DialogTitle>
                              </DialogHeader>
                              {viewingItem && (
                                <div className="space-y-4">
                                  <div>
                                    <p className="font-semibold">WhatsApp:</p>
                                    <p>{formatWhatsApp((viewingItem as CloneAgentMessageQueue).phoneNumber)}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Mensagem:</p>
                                    <p className="whitespace-pre-wrap">{getDisplayMessage(viewingItem as CloneAgentMessageQueue)}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Agendado para:</p>
                                    <p>{formatDate((viewingItem as CloneAgentMessageQueue).collectionEndTime)}</p>
                                  </div>
                                  <div className="flex justify-end gap-2 mt-4">
                                    <Button 
                                      onClick={() => handleSendNow(viewingItem.id)}
                                      disabled={sendManualMutation.isPending}
                                      data-testid={`button-send-now-mobile-${viewingItem.id}`}
                                    >
                                      {sendManualMutation.isPending ? "Enviando..." : "Enviar"}
                                    </Button>
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

                          <Dialog open={editingItem?.id === cloneItem.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-edit-clone-${cloneItem.id}`}
                                onClick={() => handleEdit(cloneItem)}
                                title="Editar mensagem"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Mensagem</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>WhatsApp</Label>
                                  <Input value={formatWhatsApp(cloneItem.phoneNumber)} disabled />
                                </div>
                                <div>
                                  <Label>Mensagem</Label>
                                  <Textarea
                                    data-testid="textarea-edit-message"
                                    value={editedMessage}
                                    onChange={(e) => setEditedMessage(e.target.value)}
                                    rows={4}
                                    placeholder="Digite a mensagem que será enviada..."
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Edite a mensagem que será enviada ao eleitor.
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => setEditingItem(null)}
                                    className="flex-1"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    data-testid="button-save-edit"
                                    onClick={handleSaveEdit}
                                    disabled={updateMutation.isPending}
                                    className="flex-1"
                                  >
                                    {updateMutation.isPending ? "Salvando..." : "Salvar"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-delete-clone-${cloneItem.id}`}
                            onClick={() => handleDelete(cloneItem.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                } else {
                  const militantItem = item as MessagesQueue;
                  return (
                    <Card key={militantItem.id} className="bg-card border-border" data-testid={`card-militant-${militantItem.id}`}>
                      <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-base text-card-foreground" data-testid={`text-militant-name-${militantItem.id}`}>
                            {getFirstName(militantItem.fromName)}
                          </p>
                          <p 
                            className="text-primary cursor-pointer hover:text-primary/80 transition-colors text-sm" 
                            data-testid={`text-militant-phone-${militantItem.id}`}
                            onClick={() => copyPhoneToClipboard(militantItem.fromPhone)}
                            title="Clique para copiar"
                          >
                            {formatWhatsAppWithoutCountry(militantItem.fromPhone)}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-evenly gap-2 w-full">
                          <Dialog open={viewingItem?.id === militantItem.id} onOpenChange={(open) => !open && setViewingItem(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-view-militant-${militantItem.id}`}
                                onClick={() => setViewingItem(militantItem)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Detalhes da Mensagem Agendada</DialogTitle>
                              </DialogHeader>
                              {viewingItem && (
                                <div className="space-y-4">
                                  <div>
                                    <p className="font-semibold">Grupo:</p>
                                    <p>{(viewingItem as MessagesQueue).groupName}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Remetente:</p>
                                    <p>{(viewingItem as MessagesQueue).fromName}</p>
                                    <p className="text-sm text-muted-foreground">{formatWhatsApp((viewingItem as MessagesQueue).fromPhone)}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Mensagem:</p>
                                    <p className="whitespace-pre-wrap">{(viewingItem as MessagesQueue).message}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Recebida em:</p>
                                    <p>{formatDate(new Date((viewingItem as MessagesQueue).timestamp * 1000))}</p>
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

                          <Dialog open={editingItem?.id === militantItem.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-edit-militant-${militantItem.id}`}
                                onClick={() => handleEdit(militantItem)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Mensagem Agendada</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Grupo</Label>
                                  <Input value={militantItem.groupName || ''} disabled />
                                </div>
                                <div>
                                  <Label>Remetente</Label>
                                  <Input value={`${militantItem.fromName} (${formatWhatsApp(militantItem.fromPhone)})`} disabled />
                                </div>
                                <div>
                                  <Label>Mensagem</Label>
                                  <Textarea
                                    data-testid="textarea-edit-message"
                                    value={editedMessage}
                                    onChange={(e) => setEditedMessage(e.target.value)}
                                    rows={4}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => setEditingItem(null)}
                                    className="flex-1"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    data-testid="button-save-edit"
                                    onClick={handleSaveEdit}
                                    disabled={updateMutation.isPending}
                                    className="flex-1"
                                  >
                                    {updateMutation.isPending ? "Salvando..." : "Salvar"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-delete-militant-${militantItem.id}`}
                            onClick={() => handleDelete(militantItem.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
              })}
              
              {/* Pagination - Mobile */}
              {totalPages > 1 && (
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="text-sm text-muted-foreground text-center">
                        Mostrando {startIndex + 1} a {Math.min(endIndex, items.length)} de {items.length} mensagens
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

export default function SchedulingsTab() {
  const [activeTab, setActiveTab] = useState<TabType>('clone');

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Agendamentos</h2>
          <p className="text-muted-foreground mt-2">Visualize e gerencie mensagens agendadas dos agentes</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="clone" className="w-full" onValueChange={(value) => setActiveTab(value as TabType)}>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
            <TabsList className="hidden md:grid w-full grid-cols-2 bg-[#090909] rounded-lg border border-border h-auto p-1 items-center">
              <TabsTrigger value="clone" data-testid="tab-trigger-clone" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Agente Clone
              </TabsTrigger>
              <TabsTrigger value="militant" data-testid="tab-trigger-militant" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Agente Militante
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="clone">
            <SchedulingsTabContent type="clone" />
          </TabsContent>

          <TabsContent value="militant">
            <SchedulingsTabContent type="militant" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
