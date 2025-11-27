import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Play, QrCode, RefreshCw, Loader2, Wifi, WifiOff, AlertCircle } from "lucide-react";

interface WahaSession {
  name: string;
  status: string;
  config?: any;
}

export default function WahaInstancesTab() {
  const [newSessionName, setNewSessionName] = useState("");
  const [wahaInstances, setWahaInstances] = useState<WahaSession[]>([]);
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{ sessionName: string; qrCode: string } | null>(null);
  const [isLoadingQrCode, setIsLoadingQrCode] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isDeletingInstance, setIsDeletingInstance] = useState<string | null>(null);
  const [isConnectingInstance, setIsConnectingInstance] = useState<string | null>(null);
  const [isReconnectingInstance, setIsReconnectingInstance] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchInstances();
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const fetchInstances = async () => {
    setIsLoadingInstances(true);
    setError(null);

    try {
      const response = await fetch("/api/waha/instances");
      const data = await response.json();

      if (data.success) {
        setWahaInstances(data.data || []);
      } else {
        setError(data.error || "Erro ao buscar instâncias");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar instâncias");
    } finally {
      setIsLoadingInstances(false);
    }
  };

  const createInstance = async () => {
    if (!newSessionName) {
      setError("Informe o nome da sessão");
      return;
    }

    setIsCreatingInstance(true);
    setError(null);

    try {
      const response = await fetch("/api/waha/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionName: newSessionName }),
      });
      const data = await response.json();

      if (data.success) {
        setNewSessionName("");
        await fetchInstances();
      } else {
        setError(data.error || "Erro ao criar instância");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar instância");
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const deleteInstance = async (sessionName: string) => {
    setIsDeletingInstance(sessionName);
    setError(null);

    try {
      const response = await fetch(`/api/waha/instances/${encodeURIComponent(sessionName)}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (data.success) {
        await fetchInstances();
      } else {
        setError(data.error || "Erro ao excluir instância");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir instância");
    } finally {
      setIsDeletingInstance(null);
    }
  };

  const connectInstance = async (sessionName: string) => {
    setIsConnectingInstance(sessionName);
    setError(null);
    
    // Open dialog immediately with loading state
    setQrCodeData({ sessionName, qrCode: '' });
    setIsQrDialogOpen(true);
    setIsLoadingQrCode(true);

    try {
      const response = await fetch(`/api/waha/instances/${encodeURIComponent(sessionName)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (data.success) {
        // Fetch QR code immediately after start
        await fetchQrCode(sessionName);
      } else {
        setIsQrDialogOpen(false);
        setError(data.error || "Erro ao conectar instância");
      }
    } catch (err) {
      setIsQrDialogOpen(false);
      setError(err instanceof Error ? err.message : "Erro ao conectar instância");
    } finally {
      setIsConnectingInstance(null);
    }
  };

  const reconnectInstance = async (sessionName: string) => {
    setIsReconnectingInstance(sessionName);
    setError(null);
    
    // Open dialog immediately with loading state
    setQrCodeData({ sessionName, qrCode: '' });
    setIsQrDialogOpen(true);
    setIsLoadingQrCode(true);

    try {
      // First, logout the session (disconnects WhatsApp account)
      await fetch(`/api/waha/instances/${encodeURIComponent(sessionName)}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Wait a moment for the logout to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Then start the session again to get new QR code
      const startResponse = await fetch(`/api/waha/instances/${encodeURIComponent(sessionName)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const startData = await startResponse.json();

      if (startData.success) {
        // Wait a moment then fetch QR code
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchQrCode(sessionName);
      } else {
        setIsQrDialogOpen(false);
        setError(startData.error || "Erro ao reconectar instância");
      }
    } catch (err) {
      setIsQrDialogOpen(false);
      setError(err instanceof Error ? err.message : "Erro ao reconectar instância");
    } finally {
      setIsReconnectingInstance(null);
      fetchInstances();
    }
  };

  const checkSessionStatus = useCallback(async (sessionName: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/waha/instances");
      const data = await response.json();
      
      if (data.success) {
        setWahaInstances(data.data || []);
        const session = (data.data || []).find((s: WahaSession) => s.name === sessionName);
        return session?.status === 'WORKING';
      }
    } catch (err) {
      console.error("Error checking session status:", err);
    }
    return false;
  }, []);

  const fetchQrCode = async (sessionName: string) => {
    setIsLoadingQrCode(true);
    setError(null);

    try {
      const response = await fetch(`/api/waha/instances/${encodeURIComponent(sessionName)}/qr`);
      const data = await response.json();

      if (data.success && data.data) {
        const qrValue = data.data.data || data.data.value || data.data;
        setQrCodeData({
          sessionName,
          qrCode: typeof qrValue === 'string' ? qrValue : JSON.stringify(qrValue),
        });
        setIsQrDialogOpen(true);

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        
        const interval = setInterval(async () => {
          const isConnected = await checkSessionStatus(sessionName);
          if (isConnected) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setIsQrDialogOpen(false);
            setQrCodeData(null);
          }
        }, 5000);
        pollingIntervalRef.current = interval;
      } else {
        setError(data.error || "Erro ao obter QR Code. Certifique-se de que a instância está no estado SCAN_QR_CODE.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao obter QR Code");
    } finally {
      setIsLoadingQrCode(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WORKING':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/50"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'SCAN_QR_CODE':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50"><QrCode className="h-3 w-3 mr-1" />Aguardando QR</Badge>;
      case 'STARTING':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/50"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Iniciando</Badge>;
      case 'STOPPED':
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/50"><WifiOff className="h-3 w-3 mr-1" />Parado</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/50"><AlertCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#090909] border-border">
        <CardHeader>
          <CardTitle data-testid="text-create-instance-title">Criar Nova Instância</CardTitle>
          <CardDescription>
            Crie uma nova sessão/instância no servidor WAHA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="session-name">Nome da Sessão</Label>
              <Input
                id="session-name"
                placeholder="Nome da nova sessão"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createInstance()}
                data-testid="input-session-name"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={createInstance}
                disabled={isCreatingInstance || !newSessionName}
                data-testid="button-create-instance"
              >
                {isCreatingInstance ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Criar Instância
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg flex items-center gap-2" data-testid="text-error-message">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Card className="bg-[#090909] border-border">
        <CardHeader>
          <CardTitle data-testid="text-instances-title">Instâncias WAHA</CardTitle>
          <CardDescription>
            Gerencie as sessões/instâncias do WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInstances && wahaInstances.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : wahaInstances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-instances">
              Nenhuma instância encontrada. Crie uma nova instância acima.
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {wahaInstances.map((instance) => (
                  <div
                    key={instance.name}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-border bg-background gap-4"
                    data-testid={`instance-card-${instance.name}`}
                  >
                    <div className="space-y-1">
                      <div className="font-medium" data-testid={`text-instance-name-${instance.name}`}>
                        {instance.name}
                      </div>
                      <div>{getStatusBadge(instance.status)}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {instance.status === 'STOPPED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => connectInstance(instance.name)}
                          disabled={isConnectingInstance === instance.name}
                          data-testid={`button-connect-${instance.name}`}
                        >
                          {isConnectingInstance === instance.name ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-1" />
                          )}
                          Conectar
                        </Button>
                      )}
                      {instance.status === 'SCAN_QR_CODE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchQrCode(instance.name)}
                          disabled={isLoadingQrCode}
                          data-testid={`button-qr-${instance.name}`}
                        >
                          {isLoadingQrCode ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <QrCode className="h-4 w-4 mr-1" />
                          )}
                          Ver QR Code
                        </Button>
                      )}
                      {instance.status === 'WORKING' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reconnectInstance(instance.name)}
                          disabled={isReconnectingInstance === instance.name}
                          data-testid={`button-reconnect-${instance.name}`}
                        >
                          {isReconnectingInstance === instance.name ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          Reconectar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Tem certeza que deseja excluir a instância "${instance.name}"?`)) {
                            deleteInstance(instance.name);
                          }
                        }}
                        disabled={isDeletingInstance === instance.name}
                        data-testid={`button-delete-${instance.name}`}
                      >
                        {isDeletingInstance === instance.name ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={isQrDialogOpen} onOpenChange={(open) => {
        if (!open && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsQrDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-qr-dialog-title">QR Code para Conexão</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo com o WhatsApp para conectar a instância "{qrCodeData?.sessionName}"
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-4 min-h-[280px]">
            {isLoadingQrCode && !qrCodeData?.qrCode ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrCodeData?.qrCode ? (
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={qrCodeData.qrCode.startsWith('data:') ? qrCodeData.qrCode : `data:image/png;base64,${qrCodeData.qrCode}`}
                  alt="QR Code"
                  className="w-64 h-64"
                  data-testid="img-qr-code"
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
