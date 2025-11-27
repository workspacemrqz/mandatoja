import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InstagramAgent, CollectorAgent, CloneAgentConfig, CloneAgentInstance, CloneAgentKnowledge, MilitantAgent, ReplicadorAgentInstance, ColetorAgentInstance } from "@shared/schema";
import { SimpleSelect, SimpleSelectContent, SimpleSelectTrigger, SimpleSelectValue, SimpleSelectItem } from "@/components/ui/simple-select";
import { ScrollableSelect, ScrollableSelectContent, ScrollableSelectTrigger, ScrollableSelectValue } from "@/components/ui/scrollable-select";
import type { ConfigOption, Leadership } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Edit2, Trash2, Pencil, Bot, Users } from "lucide-react";
import { useActivation } from "@/contexts/activation-context";
import { ActivationSpinner } from "@/components/ui/activation-spinner";

interface WhatsAppGroup {
  id: string;
  name: string;
}

interface WahaInstance {
  name: string;
  status: string;
}

function Countdown({ lastRunAt }: { lastRunAt: Date | string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!lastRunAt) {
      setTimeLeft("Aguardando primeira execução");
      return;
    }

    const updateCountdown = () => {
      const lastRun = new Date(lastRunAt).getTime();
      const nextRun = lastRun + 5 * 60 * 1000; // 5 minutos
      const now = Date.now();
      const diff = nextRun - now;

      if (diff <= 0) {
        setTimeLeft("Executando agora...");
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lastRunAt]);

  return <span className="text-sm text-muted-foreground">{timeLeft}</span>;
}

function ReplicadorCountdown({ lastRunAt }: { lastRunAt: Date | string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!lastRunAt) {
      setTimeLeft("Aguardando primeira execução");
      return;
    }

    const updateCountdown = () => {
      const lastRun = new Date(lastRunAt).getTime();
      const nextRun = lastRun + 3 * 60 * 60 * 1000; // 3 horas
      const now = Date.now();
      const diff = nextRun - now;

      if (diff <= 0) {
        setTimeLeft("Executando agora...");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lastRunAt]);

  return <span className="text-sm text-muted-foreground">{timeLeft}</span>;
}

export default function AgentesTab() {
  const [activeTab, setActiveTab] = useState("replicador");
  const [openSections, setOpenSections] = useState<string[]>([]); // Seções fechadas por padrão
  const [instagramUrl, setInstagramUrl] = useState("");
  const [whatsappRecipient, setWhatsappRecipient] = useState("");
  const [personName, setPersonName] = useState("");
  const [personInstagram, setPersonInstagram] = useState("");
  const [collectorGroup, setCollectorGroup] = useState("");
  const [collectorIndicacao, setCollectorIndicacao] = useState("");
  const [collectorMunicipio, setCollectorMunicipio] = useState("");
  const [collectorBairro, setCollectorBairro] = useState("");
  const [nome, setNome] = useState("");
  const [promptSystem, setPromptSystem] = useState("");
  const [messageCollectionTime, setMessageCollectionTime] = useState(30);
  const [sendDelaySeconds, setSendDelaySeconds] = useState(5);
  const [ollamaModel, setOllamaModel] = useState("deepseek-v3.1:671b-cloud");
  const [knowledgeInput, setKnowledgeInput] = useState("");
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [newInstance, setNewInstance] = useState({ instanceName: "", wahaSession: "" });
  const [editingInstance, setEditingInstance] = useState({ instanceName: "", wahaSession: "" });
  const [newReplicadorInstance, setNewReplicadorInstance] = useState({ instanceName: "", wahaSession: "" });
  const [editingReplicadorInstance, setEditingReplicadorInstance] = useState({ instanceName: "", wahaSession: "" });
  const [editingReplicadorInstanceId, setEditingReplicadorInstanceId] = useState<string | null>(null);
  const [newColetorInstance, setNewColetorInstance] = useState({ instanceName: "", wahaSession: "" });
  const [editingColetorInstance, setEditingColetorInstance] = useState({ instanceName: "", wahaSession: "" });
  const [editingColetorInstanceId, setEditingColetorInstanceId] = useState<string | null>(null);
  const [militantName, setMilitantName] = useState("");
  const [militantSystemPrompt, setMilitantSystemPrompt] = useState("");
  const [militantFlowMinutes, setMilitantFlowMinutes] = useState(10);
  const [militantMessageCollectionTime, setMilitantMessageCollectionTime] = useState(30);
  const [militantOllamaModel, setMilitantOllamaModel] = useState("deepseek-v3.1:671b-cloud");
  const [selectedMilitantGroups, setSelectedMilitantGroups] = useState<Array<{id: string, name: string, active: boolean}>>([]);
  const [editingMilitantAgent, setEditingMilitantAgent] = useState<MilitantAgent | null>(null);
  const [wizardCurrentStep, setWizardCurrentStep] = useState<1 | 2>(1);
  const [wizardData, setWizardData] = useState<{name: string, systemPrompt: string, wahaSession: string}>({
    name: "",
    systemPrompt: "",
    wahaSession: ""
  });
  const [isVerifyingWaha, setIsVerifyingWaha] = useState(false);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [tempPromptSystem, setTempPromptSystem] = useState("");
  const [isMilitantPromptEditorOpen, setIsMilitantPromptEditorOpen] = useState(false);
  const [tempMilitantSystemPrompt, setTempMilitantSystemPrompt] = useState("");
  const [isAddCloneInstanceOpen, setIsAddCloneInstanceOpen] = useState(false);
  const [isAddReplicadorInstanceOpen, setIsAddReplicadorInstanceOpen] = useState(false);
  const [isAddColetorInstanceOpen, setIsAddColetorInstanceOpen] = useState(false);
  const [isAddReplicadorAgentOpen, setIsAddReplicadorAgentOpen] = useState(false);
  const [isAddColetorAgentOpen, setIsAddColetorAgentOpen] = useState(false);
  const [isEditReplicadorAgentOpen, setIsEditReplicadorAgentOpen] = useState(false);
  const [isAddMilitantAgentOpen, setIsAddMilitantAgentOpen] = useState(false);
  const [isEditMilitantAgentOpen, setIsEditMilitantAgentOpen] = useState(false);
  const [isEditColetorAgentOpen, setIsEditColetorAgentOpen] = useState(false);
  const [isEditCloneInstanceOpen, setIsEditCloneInstanceOpen] = useState(false);
  const [isEditReplicadorInstanceOpen, setIsEditReplicadorInstanceOpen] = useState(false);
  const [isEditColetorInstanceOpen, setIsEditColetorInstanceOpen] = useState(false);
  const [editingReplicadorAgent, setEditingReplicadorAgent] = useState<InstagramAgent | null>(null);
  const [editingColetorAgent, setEditingColetorAgent] = useState<CollectorAgent | null>(null);
  const [editingCloneInstanceForDialog, setEditingCloneInstanceForDialog] = useState<CloneAgentInstance | null>(null);
  const [editingReplicadorInstanceForDialog, setEditingReplicadorInstanceForDialog] = useState<ReplicadorAgentInstance | null>(null);
  const [editingColetorInstanceForDialog, setEditingColetorInstanceForDialog] = useState<ColetorAgentInstance | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<null | { type: 'clone' | 'replicador' | 'coletor'; id: string }>(null);
  const [isDeleteConfirmEnabled, setIsDeleteConfirmEnabled] = useState(false);
  const [availableMilitantGroups, setAvailableMilitantGroups] = useState<Array<{id: string, name: string}>>([]);
  const [isLoadingMilitantGroups, setIsLoadingMilitantGroups] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [managingGroupsAgent, setManagingGroupsAgent] = useState<MilitantAgent | null>(null);
  const { isActivating, startActivation, stopActivation } = useActivation();

  // Fetch current agent status
  const { data: agents, isLoading } = useQuery<InstagramAgent[]>({
    queryKey: ["/api/instagram-agents"],
    refetchInterval: 10000, // Refetch every 10 seconds to update countdown
  });

  // Fetch collector agents
  const { data: collectorAgents, isLoading: isLoadingCollectorAgents } = useQuery<CollectorAgent[]>({
    queryKey: ["/api/collector-agents"],
    refetchInterval: 10000, // Refetch every 10 seconds to update countdown
  });

  // REMOVED: Global groups query - each agent type should use its own instance-specific groups
  // Militant agents now handle groups differently since they have per-agent credentials

  // Fetch município configuration options
  const { data: municipioOptions = [] } = useQuery<ConfigOption[]>({
    queryKey: ['/api/config-options/municipio'],
  });

  // Fetch bairro configuration options - filtered by selected município
  const { data: bairroOptions = [] } = useQuery<ConfigOption[]>({
    queryKey: collectorMunicipio 
      ? ['/api/config-options/bairro', { municipio: collectorMunicipio }]
      : ['/api/config-options/bairro'],
    queryFn: collectorMunicipio
      ? async () => {
          const response = await fetch(`/api/config-options/bairro?municipio=${encodeURIComponent(collectorMunicipio)}`);
          if (!response.ok) throw new Error('Failed to fetch bairros');
          return response.json();
        }
      : undefined,
    enabled: !!collectorMunicipio,
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

  // Fetch WAHA instances for dropdown selectors
  const { data: wahaInstancesData } = useQuery<{ success: boolean; data: WahaInstance[] }>({
    queryKey: ["/api/waha/instances"],
  });
  const wahaInstances = wahaInstancesData?.data || [];

  // Fetch clone agent config (singleton)
  const { data: config, isLoading: isLoadingConfig } = useQuery<CloneAgentConfig | null>({
    queryKey: ['/api/clone-agent/config'],
  });

  // Fetch clone agent instances
  const { data: instances = [], isLoading: isLoadingInstances } = useQuery<CloneAgentInstance[]>({
    queryKey: ['/api/clone-agent/instances'],
  });

  // Fetch clone agent knowledge
  const { data: knowledge = [] } = useQuery<CloneAgentKnowledge[]>({
    queryKey: ['/api/clone-agent/knowledge'],
    enabled: !!config,
  });

  // Fetch replicador agent instance (single instance)
  const { data: replicadorInstance, isLoading: isLoadingReplicadorInstance } = useQuery<ReplicadorAgentInstance | null>({
    queryKey: ['/api/replicador-agent/instance'],
  });

  // Fetch WhatsApp groups specifically from Replicador Agent instance
  const { data: replicadorGroupsResponse, isLoading: isLoadingReplicadorGroups } = useQuery<{ groups: WhatsAppGroup[], error: string | null }>({
    queryKey: ["/api/replicador-agent/groups"],
    enabled: !!replicadorInstance, // Only fetch if there's a replicador instance
  });
  
  const replicadorGroups = replicadorGroupsResponse?.groups || [];
  const replicadorGroupsError = replicadorGroupsResponse?.error || null;

  // Fetch coletor agent instance (single instance)
  const { data: coletorInstance, isLoading: isLoadingColetorInstance } = useQuery<ColetorAgentInstance | null>({
    queryKey: ['/api/coletor-agent/instance'],
  });

  // Fetch WhatsApp groups specifically from Coletor Agent instance
  const { data: coletorGroupsResponse, isLoading: isLoadingColetorGroups } = useQuery<{ groups: WhatsAppGroup[], error: string | null }>({
    queryKey: ["/api/coletor-agent/groups"],
    enabled: !!coletorInstance, // Only fetch if there's a coletor instance
  });
  
  const coletorGroups = coletorGroupsResponse?.groups || [];
  const coletorGroupsError = coletorGroupsResponse?.error || null;

  // Populate form fields when config loads
  useEffect(() => {
    if (config) {
      setNome(config.nome);
      setPromptSystem(config.promptSystem);
      setMessageCollectionTime(config.messageCollectionTime);
      setSendDelaySeconds(config.sendDelaySeconds || 5);
      setOllamaModel(config.ollamaModel);
    }
  }, [config]);

  // Fetch militant agents
  const { data: militantAgents = [], isLoading: isLoadingMilitantAgents } = useQuery<MilitantAgent[]>({
    queryKey: ["/api/militant-agents"],
  });

  // REMOVED: Automatic useEffect that was interfering with the wizard
  // The wizard's "Ativar" button in Step 2 is now the only way to verify credentials and fetch groups

  const currentAgent = agents?.[0];

  // Create/update agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (data: { instagramUrl: string; whatsappRecipient: string; groupName: string; personName: string; personInstagram: string }) => {
      return await apiRequest("/api/instagram-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram-agents"] });
      setInstagramUrl("");
      setWhatsappRecipient("");
      setPersonName("");
      setPersonInstagram("");
    },
    onError: () => {
    },
  });

  // Toggle agent status mutation
  const toggleAgentMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      startActivation(`instagram-agent-${id}`);
      return await apiRequest(`/api/instagram-agents/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram-agents"] });
    },
    onError: () => {
    },
    onSettled: (_, __, { id }) => {
      stopActivation(`instagram-agent-${id}`);
    },
  });

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { personName: string; personInstagram: string; instagramUrl: string; whatsappRecipient: string } }) => {
      return await apiRequest(`/api/instagram-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram-agents"] });
      setIsEditReplicadorAgentOpen(false);
      setEditingReplicadorAgent(null);
      setPersonName("");
      setPersonInstagram("");
      setInstagramUrl("");
      setWhatsappRecipient("");
    },
    onError: () => {
    },
  });

  // Delete agent mutation
  const deleteAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/instagram-agents/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram-agents"] });
    },
    onError: () => {
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      return;
    }
    if (!personInstagram.trim()) {
      return;
    }
    if (!instagramUrl.trim()) {
      return;
    }
    if (!whatsappRecipient.trim()) {
      return;
    }
    
    const selectedGroup = replicadorGroups.find(g => g.id === whatsappRecipient);
    const groupName = selectedGroup ? selectedGroup.name : "";
    
    createAgentMutation.mutate({ instagramUrl, whatsappRecipient, groupName, personName, personInstagram });
  };

  const handleToggle = () => {
    if (!currentAgent) return;
    toggleAgentMutation.mutate({
      id: currentAgent.id,
      isActive: !currentAgent.isActive,
    });
  };

  const handleDelete = () => {
    if (!currentAgent) return;
    if (window.confirm("Tem certeza que deseja excluir este agente?")) {
      deleteAgentMutation.mutate(currentAgent.id);
    }
  };

  // Collector Agent mutations
  const createCollectorAgentMutation = useMutation({
    mutationFn: async (data: { groupId: string; groupName: string; indicacao: string; municipio: string; bairro: string }) => {
      return await apiRequest('/api/collector-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collector-agents'] });
      setCollectorGroup("");
      setCollectorIndicacao("");
      setCollectorMunicipio("");
      setCollectorBairro("");
      setIsAddColetorAgentOpen(false);
    },
    onError: () => {
    },
  });

  const toggleCollectorAgentMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      startActivation(`collector-agent-${id}`);
      return await apiRequest(`/api/collector-agents/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collector-agents'] });
    },
    onError: () => {
    },
    onSettled: (_, __, { id }) => {
      stopActivation(`collector-agent-${id}`);
    },
  });

  const updateCollectorAgentMutation = useMutation({
    mutationFn: async ({ id, groupId, municipio, indicacao }: { id: string; groupId: string; municipio: string; indicacao: string }) => {
      return await apiRequest(`/api/collector-agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, municipio, indicacao }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collector-agents'] });
      setIsEditColetorAgentOpen(false);
      setEditingColetorAgent(null);
      setCollectorGroup('');
      setCollectorMunicipio('');
      setCollectorIndicacao('');
    },
    onError: () => {
    },
  });

  const deleteCollectorAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/collector-agents/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collector-agents'] });
    },
    onError: () => {
    },
  });

  const collectVotersMutation = useMutation({
    mutationFn: async (data: { groupId: string; indicacao: string; municipio: string; bairro: string }) => {
      return await apiRequest('/api/whatsapp/collect-voters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voters'] });
      setCollectorGroup("");
      setCollectorIndicacao("");
      setCollectorMunicipio("");
      setCollectorBairro("");
    },
    onError: (error) => {
    },
  });

  const handleCollectVoters = () => {
    if (!collectorGroup) {
      return;
    }
    if (!collectorIndicacao) {
      return;
    }
    if (!collectorMunicipio) {
      return;
    }
    collectVotersMutation.mutate({
      groupId: collectorGroup,
      indicacao: collectorIndicacao,
      municipio: collectorMunicipio,
      bairro: collectorBairro || "",
    });
  };

  // Clone Agent Config Mutations
  const createConfigMutation = useMutation({
    mutationFn: async (data: { nome: string; promptSystem: string; messageCollectionTime: number; sendDelaySeconds: number; ollamaModel: string }) => {
      return await apiRequest('/api/clone-agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/config'] });
    },
    onError: () => {
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: { nome?: string; promptSystem?: string; messageCollectionTime?: number; sendDelaySeconds?: number; ollamaModel?: string }) => {
      return await apiRequest('/api/clone-agent/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/config'] });
    },
    onError: () => {
    },
  });

  // Clone Agent Instance Mutations
  const createInstanceMutation = useMutation({
    mutationFn: async (data: { configId: string; instanceName: string; wahaSession: string }) => {
      return await apiRequest('/api/clone-agent/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/instances'] });
      setNewInstance({ instanceName: "", wahaSession: "" });
      setIsAddCloneInstanceOpen(false);
    },
    onError: () => {
    },
  });

  const updateInstanceMutation = useMutation({
    mutationFn: async ({ id, instanceName, wahaSession }: { id: string; instanceName: string; wahaSession: string }) => {
      return await apiRequest(`/api/clone-agent/instances/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, wahaSession }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/instances'] });
      setEditingInstanceId(null);
      setIsEditCloneInstanceOpen(false);
      setEditingCloneInstanceForDialog(null);
      setEditingInstance({ instanceName: "", wahaSession: "" });
      // Fecha a seção aberta ligada à instância em edição
      setOpenSections(prev => {
        if (!editingInstanceId) return prev;
        return prev.filter(key => key !== `instance-${editingInstanceId}`);
      });
    },
    onError: () => {
    },
  });

  const toggleInstanceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      startActivation(`clone-instance-${id}`);
      return await apiRequest(`/api/clone-agent/instances/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/instances'] });
      
      // If activating, check WAHA connection status
      if (variables.isActive) {
        const instance = instances.find(i => i.id === variables.id);
        if (instance?.wahaUrl && instance?.wahaApiKey && instance?.wahaSession) {
          try {
            const statusResponse = await fetch(
              `/api/waha/session-status?wahaUrl=${encodeURIComponent(instance.wahaUrl)}&wahaApiKey=${encodeURIComponent(instance.wahaApiKey)}&session=${encodeURIComponent(instance.wahaSession)}`
            );
            const statusData = await statusResponse.json();
            
            if (!statusData.connected) {
              queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/instances'] });
              return;
            }
          } catch (error) {
            console.error('Error checking WAHA status:', error);
          }
        }
      }
    },
    onError: () => {
    },
    onSettled: (_, __, { id }) => {
      stopActivation(`clone-instance-${id}`);
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/clone-agent/instances/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/instances'] });
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: () => {
    },
  });

  // Clone Agent Knowledge Mutations
  const createKnowledgeMutation = useMutation({
    mutationFn: async (data: { configId: string; content: string }) => {
      return await apiRequest('/api/clone-agent/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/knowledge'] });
      setKnowledgeInput("");
    },
    onError: () => {
    },
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/clone-agent/knowledge/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clone-agent/knowledge'] });
    },
    onError: () => {
    },
  });

  // Replicador Agent Instance Mutations
  const createReplicadorInstanceMutation = useMutation({
    mutationFn: async (data: { instanceName: string; wahaSession: string }) => {
      return await apiRequest('/api/replicador-agent/instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/replicador-agent/instance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/replicador-agent/groups'] });
      setNewReplicadorInstance({ instanceName: "", wahaSession: "" });
      setIsAddReplicadorInstanceOpen(false);
    },
    onError: (error: any) => {
    },
  });

  const updateReplicadorInstanceMutation = useMutation({
    mutationFn: async ({ id, instanceName, wahaSession }: { id: string; instanceName: string; wahaSession: string }) => {
      return await apiRequest(`/api/replicador-agent/instance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, wahaSession }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/replicador-agent/instance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/replicador-agent/groups'] });
      setEditingReplicadorInstanceId(null);
      setIsEditReplicadorInstanceOpen(false);
      setEditingReplicadorInstanceForDialog(null);
      setEditingReplicadorInstance({ instanceName: "", wahaSession: "" });
      if (replicadorInstance) {
        setOpenSections(prev => prev.filter(key => key !== `replicador-instance-${replicadorInstance.id}`));
      }
    },
    onError: () => {
    },
  });

  const toggleReplicadorInstanceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      startActivation(`replicador-instance-${id}`);
      return await apiRequest(`/api/replicador-agent/instance/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/replicador-agent/instance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/replicador-agent/groups'] });
      
      // If activating, check WAHA connection status
      if (variables.isActive && replicadorInstance?.wahaUrl && replicadorInstance?.wahaApiKey && replicadorInstance?.wahaSession) {
        try {
          const statusResponse = await fetch(
            `/api/waha/session-status?wahaUrl=${encodeURIComponent(replicadorInstance.wahaUrl)}&wahaApiKey=${encodeURIComponent(replicadorInstance.wahaApiKey)}&session=${encodeURIComponent(replicadorInstance.wahaSession)}`
          );
          const statusData = await statusResponse.json();
          
          if (!statusData.connected) {
            queryClient.invalidateQueries({ queryKey: ['/api/replicador-agent/instance'] });
            return;
          }
        } catch (error) {
          console.error('Error checking WAHA status:', error);
        }
      }
    },
    onError: () => {
    },
    onSettled: (_, __, { id }) => {
      stopActivation(`replicador-instance-${id}`);
    },
  });

  const deleteReplicadorInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/replicador-agent/instance/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/replicador-agent/instance'] });
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: () => {
    },
  });

  // Coletor Agent Instance Mutations
  const createColetorInstanceMutation = useMutation({
    mutationFn: async (data: { instanceName: string; wahaSession: string }) => {
      return await apiRequest('/api/coletor-agent/instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coletor-agent/instance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coletor-agent/groups'] });
      setNewColetorInstance({ instanceName: "", wahaSession: "" });
      setIsAddColetorInstanceOpen(false);
    },
    onError: (error: any) => {
    },
  });

  const updateColetorInstanceMutation = useMutation({
    mutationFn: async ({ id, instanceName, wahaSession }: { id: string; instanceName: string; wahaSession: string }) => {
      return await apiRequest(`/api/coletor-agent/instance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, wahaSession }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coletor-agent/instance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coletor-agent/groups'] });
      setEditingColetorInstanceId(null);
      setIsEditColetorInstanceOpen(false);
      setEditingColetorInstanceForDialog(null);
      setEditingColetorInstance({ instanceName: "", wahaSession: "" });
    },
    onError: () => {
    },
  });

  const toggleColetorInstanceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      startActivation(`coletor-instance-${id}`);
      return await apiRequest(`/api/coletor-agent/instance/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/coletor-agent/instance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coletor-agent/groups'] });
      
      // If activating, check WAHA connection status
      if (variables.isActive && coletorInstance?.wahaUrl && coletorInstance?.wahaApiKey && coletorInstance?.wahaSession) {
        try {
          const statusResponse = await fetch(
            `/api/waha/session-status?wahaUrl=${encodeURIComponent(coletorInstance.wahaUrl)}&wahaApiKey=${encodeURIComponent(coletorInstance.wahaApiKey)}&session=${encodeURIComponent(coletorInstance.wahaSession)}`
          );
          const statusData = await statusResponse.json();
          
          if (!statusData.connected) {
            queryClient.invalidateQueries({ queryKey: ['/api/coletor-agent/instance'] });
            return;
          }
        } catch (error) {
          console.error('Error checking WAHA status:', error);
        }
      }
    },
    onError: () => {
    },
    onSettled: (_, __, { id }) => {
      stopActivation(`coletor-instance-${id}`);
    },
  });

  const deleteColetorInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/coletor-agent/instance/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coletor-agent/instance'] });
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: () => {
    },
  });

  // Enable delete confirm button only after 500ms when dialog opens
  useEffect(() => {
    if (isDeleteDialogOpen) {
      setIsDeleteConfirmEnabled(false);
      const t = setTimeout(() => setIsDeleteConfirmEnabled(true), 500);
      return () => clearTimeout(t);
    }
  }, [isDeleteDialogOpen]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    if (type === 'clone') {
      deleteInstanceMutation.mutate(id);
    } else if (type === 'replicador') {
      deleteReplicadorInstanceMutation.mutate(id);
    } else if (type === 'coletor') {
      deleteColetorInstanceMutation.mutate(id);
    }
  };

  // Clone Agent Handlers
  const handleSaveConfig = () => {
    if (!nome.trim()) {
      return;
    }
    if (!promptSystem.trim()) {
      return;
    }
    if (messageCollectionTime < 1 || messageCollectionTime > 300) {
      return;
    }
    if (sendDelaySeconds < 1 || sendDelaySeconds > 60) {
      return;
    }

    const data = { 
      nome, 
      promptSystem, 
      messageCollectionTime,
      sendDelaySeconds,
      ollamaModel
    };
    if (config) {
      updateConfigMutation.mutate(data);
    } else {
      createConfigMutation.mutate(data);
    }
  };

  const handleAddInstance = () => {
    if (!config) {
      return;
    }
    if (!newInstance.instanceName.trim()) {
      return;
    }
    if (!newInstance.wahaSession.trim()) {
      return;
    }

    createInstanceMutation.mutate({
      configId: config.id,
      instanceName: newInstance.instanceName,
      wahaSession: newInstance.wahaSession,
    });
  };

  const handleAddKnowledge = () => {
    if (!config) {
      return;
    }
    if (!knowledgeInput.trim()) {
      return;
    }

    createKnowledgeMutation.mutate({
      configId: config.id,
      content: knowledgeInput,
    });
  };

  // Prompt Editor Handlers
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleOpenPromptEditor = () => {
    setTempPromptSystem(promptSystem);
    setIsPromptEditorOpen(true);
  };

  const handleClosePromptEditor = () => {
    setIsPromptEditorOpen(false);
  };

  const handleSavePromptEditor = () => {
    // Atualiza estado local
    setPromptSystem(tempPromptSystem);
    
    // Salva diretamente no backend (Clone Agent sempre está em modo edição)
    if (config) {
      updateConfigMutation.mutate(
        { promptSystem: tempPromptSystem },
        {
          onSuccess: () => {
            setIsPromptEditorOpen(false);
            console.log("Prompt do sistema atualizado com sucesso");
          },
          onError: (error) => {
            console.error("Error updating prompt:", error);
          },
        }
      );
    } else {
      // Se não há config, apenas fecha (não deveria acontecer)
      setIsPromptEditorOpen(false);
    }
  };

  // Militant Prompt Editor Handlers
  const handleOpenMilitantPromptEditor = () => {
    setTempMilitantSystemPrompt(militantSystemPrompt);
    setIsMilitantPromptEditorOpen(true);
  };

  const handleCloseMilitantPromptEditor = () => {
    setIsMilitantPromptEditorOpen(false);
  };

  const handleSaveMilitantPromptEditor = () => {
    // Atualiza estado local
    setMilitantSystemPrompt(tempMilitantSystemPrompt);
    
    // Se estamos em modo de edição (editingMilitantAgent existe), salva no backend
    if (editingMilitantAgent) {
      updateMilitantAgentMutation.mutate(
        {
          id: editingMilitantAgent.id,
          name: militantName,
          systemPrompt: tempMilitantSystemPrompt,
          wahaSession: editingMilitantAgent.wahaSession || "",
          flowMinutes: militantFlowMinutes,
          messageCollectionTime: militantMessageCollectionTime,
          ollamaModel: militantOllamaModel,
          groups: JSON.stringify(selectedMilitantGroups)
        },
        {
          onSuccess: () => {
            setIsMilitantPromptEditorOpen(false);
            console.log("Prompt do sistema atualizado com sucesso");
          },
          onError: (error) => {
            console.error("Error updating militant agent prompt:", error);
          },
        }
      );
    } else {
      // Em modo criação: apenas fecha o popup (estado já foi atualizado)
      setIsMilitantPromptEditorOpen(false);
    }
  };

  // Replicador Agent Instance Handlers
  const handleAddReplicadorInstance = () => {
    if (replicadorInstance) {
      return;
    }
    if (!newReplicadorInstance.instanceName.trim()) {
      return;
    }
    if (!newReplicadorInstance.wahaSession.trim()) {
      return;
    }

    createReplicadorInstanceMutation.mutate(newReplicadorInstance);
  };

  // Coletor Agent Instance Handlers
  const handleAddColetorInstance = () => {
    if (coletorInstance) {
      return;
    }
    if (!newColetorInstance.instanceName.trim()) {
      return;
    }
    if (!newColetorInstance.wahaSession.trim()) {
      return;
    }

    createColetorInstanceMutation.mutate(newColetorInstance);
  };

  // Militant Agent Mutations
  const createMilitantAgentMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      systemPrompt: string; 
      groups: string;
      wahaSession: string;
    }) => {
      return await apiRequest("/api/militant-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/militant-agents"] });
      setMilitantName("");
      setMilitantSystemPrompt("");
      setSelectedMilitantGroups([]);
      setAvailableMilitantGroups([]);
      setEditingMilitantAgent(null);
      setWizardCurrentStep(1);
      setWizardData({
        name: "",
        systemPrompt: "",
        wahaSession: ""
      });
      setIsAddMilitantAgentOpen(false);
    },
    onError: () => {
    },
  });

  const updateMilitantAgentMutation = useMutation({
    mutationFn: async ({ id, name, systemPrompt, wahaSession, flowMinutes, messageCollectionTime, ollamaModel, groups }: { 
      id: string; 
      name: string; 
      systemPrompt: string;
      wahaSession: string;
      flowMinutes?: number;
      messageCollectionTime?: number;
      ollamaModel?: string;
      groups?: string;
    }) => {
      return await apiRequest(`/api/militant-agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, systemPrompt, wahaSession, flowMinutes, messageCollectionTime, ollamaModel, groups }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/militant-agents"] });
      setEditingMilitantAgent(null);
      setMilitantName("");
      setMilitantSystemPrompt("");
      setSelectedMilitantGroups([]);
      setAvailableMilitantGroups([]);
      setIsEditMilitantAgentOpen(false);
    },
    onError: () => {
    },
  });

  const updateMilitantAgentGroupsMutation = useMutation({
    mutationFn: async ({ id, groups }: { id: string; groups: Array<{id: string, name: string, active: boolean}> }) => {
      return await apiRequest(`/api/militant-agents/${id}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/militant-agents"] });
      setIsManageGroupsOpen(false);
      setManagingGroupsAgent(null);
      setSelectedMilitantGroups([]);
      setAvailableMilitantGroups([]);
    },
    onError: () => {
    },
  });

  const toggleMilitantAgentMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      startActivation(`militant-agent-${id}`);
      return await apiRequest(`/api/militant-agents/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/militant-agents"] });
      
      // If activating, check WAHA connection status
      if (variables.isActive) {
        const agent = militantAgents.find(a => a.id === variables.id);
        if (agent?.wahaUrl && agent?.wahaApiKey && agent?.wahaSession) {
          try {
            const statusResponse = await fetch(
              `/api/waha/session-status?wahaUrl=${encodeURIComponent(agent.wahaUrl)}&wahaApiKey=${encodeURIComponent(agent.wahaApiKey)}&session=${encodeURIComponent(agent.wahaSession)}`
            );
            const statusData = await statusResponse.json();
            
            if (!statusData.connected) {
              queryClient.invalidateQueries({ queryKey: ["/api/militant-agents"] });
              return;
            }
          } catch (error) {
            console.error('Error checking WAHA status:', error);
          }
        }
      }
    },
    onError: () => {
    },
    onSettled: (_, __, { id }) => {
      stopActivation(`militant-agent-${id}`);
    },
  });

  const deleteMilitantAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/militant-agents/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/militant-agents"] });
    },
    onError: () => {
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
              Agentes
            </h2>
            <p className="text-muted-foreground mt-2" data-testid="text-page-subtitle">
              Gerenciamento de agentes automáticos
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop TabsList - Hidden on mobile */}
          <TabsList className="hidden md:grid w-full grid-cols-4 bg-[#090909] rounded-lg border border-border h-auto p-1 items-center" data-testid="tabs-list">
            <TabsTrigger value="replicador" data-testid="tab-replicador" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Agente Replicador
            </TabsTrigger>
            <TabsTrigger value="militantes" data-testid="tab-militantes" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Agentes Militantes
            </TabsTrigger>
            <TabsTrigger value="clone" data-testid="tab-clone" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Agente Clone
            </TabsTrigger>
            <TabsTrigger value="coletor" data-testid="tab-coletor" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Agente Coletor
            </TabsTrigger>
          </TabsList>

          {/* Mobile Dropdown - Hidden on desktop */}
          <div className="md:hidden mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between bg-[#090909] border-border"
                  data-testid="mobile-tab-dropdown"
                >
                  <span>
                    {activeTab === "replicador" && "Agente Replicador"}
                    {activeTab === "militantes" && "Agentes Militantes"}
                    {activeTab === "clone" && "Agente Clone"}
                    {activeTab === "coletor" && "Agente Coletor"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(100vw-3rem)]" align="start">
                <DropdownMenuItem 
                  onClick={() => setActiveTab("replicador")}
                  data-testid="mobile-tab-replicador"
                  className={activeTab === "replicador" ? "bg-primary text-primary-foreground" : ""}
                >
                  Agente Replicador
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setActiveTab("militantes")}
                  data-testid="mobile-tab-militantes"
                  className={activeTab === "militantes" ? "bg-primary text-primary-foreground" : ""}
                >
                  Agentes Militantes
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setActiveTab("clone")}
                  data-testid="mobile-tab-clone"
                  className={activeTab === "clone" ? "bg-primary text-primary-foreground" : ""}
                >
                  Agente Clone
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setActiveTab("coletor")}
                  data-testid="mobile-tab-coletor"
                  className={activeTab === "coletor" ? "bg-primary text-primary-foreground" : ""}
                >
                  Agente Coletor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Agente Replicador Tab */}
          <TabsContent value="replicador" className="space-y-4">
            {/* Ações no topo: Instância e Agente lado a lado */}
            <div className="flex justify-start gap-2">
              {!replicadorInstance && (
                <Button
                  onClick={() => setIsAddReplicadorInstanceOpen(true)}
                  aria-label="Abrir modal de Adicionar Agente do Replicador"
                  data-testid="button-open-replicador-add-instance"
                  variant="outline"
                  size="sm"
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Adicionar Agente
                </Button>
              )}
              {replicadorInstance && (
                <Button 
                  onClick={() => setIsAddReplicadorAgentOpen(true)} 
                  data-testid="button-open-add-replicador-agent"
                  variant="outline"
                  size="sm"
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Adicionar Agente
                </Button>
              )}
            </div>
            {/* Removido: Card 'Instância Configurada' - instância será exibida abaixo do 'Agente Replicador' */}
            {/* Header removido conforme solicitação: seguir diretamente para a planilha */}

            {/* Instância do Replicador - movida para cima da planilha */}
            {replicadorInstance && (
              <div className="space-y-4">
                <Collapsible
                  open={openSections.includes(`replicador-instance-${replicadorInstance.id}`)}
                  onOpenChange={(open) => {
                    setOpenSections(prev =>
                      open ? [...prev, `replicador-instance-${replicadorInstance.id}`] : prev.filter(key => key !== `replicador-instance-${replicadorInstance.id}`)
                    );
                  }}
                >
                  <div className="p-4 bg-[#090909] rounded-lg border border-border space-y-3">
                    <div className="flex justify-between items-center p-2 rounded" data-testid={`replicador-instance-card-${replicadorInstance.id}`}>
                      <div>
                        <h5 className="font-semibold">{replicadorInstance.instanceName}</h5>
                        <p className="text-sm text-muted-foreground">
                          Status: {replicadorInstance.isActive ? <span className="text-green-500">Ativo</span> : <span className="text-red-500">Inativo</span>}
                        </p>
                      </div>
                      {editingReplicadorInstanceId === replicadorInstance.id ? null : (
                        <div className="flex gap-3 items-center">
                          <Switch
                            checked={replicadorInstance.isActive}
                            onCheckedChange={(checked) => toggleReplicadorInstanceMutation.mutate({ id: replicadorInstance.id, isActive: checked })}
                            disabled={toggleReplicadorInstanceMutation.isPending || isActivating(`replicador-instance-${replicadorInstance.id}`)}
                            data-testid={`button-toggle-replicador-instance-${replicadorInstance.id}`}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setEditingReplicadorInstanceForDialog(replicadorInstance);
                              setEditingReplicadorInstance({
                                instanceName: replicadorInstance.instanceName,
                                wahaUrl: replicadorInstance.wahaUrl,
                                wahaApiKey: replicadorInstance.wahaApiKey,
                                wahaSession: replicadorInstance.wahaSession || ""
                              });
                              setIsEditReplicadorInstanceOpen(true);
                            }}
                            data-testid={`button-edit-replicador-instance-${replicadorInstance.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setDeleteTarget({ type: 'replicador', id: replicadorInstance.id });
                              setIsDeleteDialogOpen(true);
                            }}
                            disabled={deleteReplicadorInstanceMutation.isPending}
                            data-testid={`button-delete-replicador-instance-${replicadorInstance.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <CollapsibleContent>
                      <div className="pt-3 space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Instância configurada. Use o botão de editar acima para modificar as configurações.
                        </p>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>
            )}

            {/* Seção de monitoramento em grid/tabela: só aparece com instância configurada */}
            {replicadorInstance && agents && agents.length > 0 && (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block rounded-lg border border-border bg-[#090909] overflow-hidden">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Nome</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Instagram</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Grupo</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Status</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Próxima Execução</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent) => {
                        const canActivate = !!replicadorInstance && !!replicadorInstance.isActive;
                        const isActiveEffective = canActivate ? !!agent.isActive : false;
                        return (
                          <tr key={agent.id} className="border-b border-border last:border-b-0">
                            <td className="p-3 text-xs border-r border-border truncate">{agent.personName || '—'}</td>
                            <td className="p-3 text-xs border-r border-border truncate">
                              {agent.personInstagram 
                                ? `@${agent.personInstagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')}` 
                                : '—'}
                            </td>
                            <td className="p-3 text-xs border-r border-border truncate">{agent.groupName || '—'}</td>
                            <td className="p-3 text-xs border-r border-border">
                              <span className={`font-medium ${isActiveEffective ? 'text-green-600' : 'text-gray-500'}`}>
                                {isActiveEffective ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="p-3 text-xs border-r border-border" data-testid={`text-countdown-${agent.id}`}>
                              {isActiveEffective ? <ReplicadorCountdown lastRunAt={agent.lastRunAt} /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2 items-center">
                                <Switch
                                  checked={agent.isActive}
                                  onCheckedChange={(checked) => toggleAgentMutation.mutate({ id: agent.id, isActive: checked })}
                                  disabled={toggleAgentMutation.isPending || !canActivate || isActivating(`instagram-agent-${agent.id}`)}
                                  data-testid={`button-toggle-agent-${agent.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingReplicadorAgent(agent);
                                    setPersonName(agent.personName || '');
                                    setPersonInstagram(agent.personInstagram || '');
                                    setInstagramUrl(agent.instagramUrl || '');
                                    setWhatsappRecipient(agent.whatsappRecipient || '');
                                    setIsEditReplicadorAgentOpen(true);
                                  }}
                                  data-testid={`button-edit-agent-${agent.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => {
                                    if (window.confirm('Tem certeza que deseja excluir este agente?')) {
                                      deleteAgentMutation.mutate(agent.id);
                                    }
                                  }}
                                  disabled={deleteAgentMutation.isPending}
                                  data-testid={`button-delete-agent-${agent.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {agents.map((agent) => {
                    const canActivate = !!replicadorInstance && !!replicadorInstance.isActive;
                    const isActiveEffective = canActivate ? !!agent.isActive : false;
                    return (
                      <Card key={agent.id} className="bg-card border-border" data-testid={`card-agent-${agent.id}-mobile`}>
                        <CardContent className="p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-lg" data-testid={`text-agent-name-${agent.id}-mobile`}>
                              {agent.personName || '—'}
                            </p>
                            <span className={`text-sm font-medium ${isActiveEffective ? 'text-green-600' : 'text-gray-500'}`}>
                              {isActiveEffective ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Instagram: {agent.personInstagram ? `@${agent.personInstagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')}` : '—'}</p>
                            <p>Grupo: {agent.groupName || '—'}</p>
                            {isActiveEffective && (
                              <p data-testid={`text-countdown-${agent.id}-mobile`}>
                                Próxima: <ReplicadorCountdown lastRunAt={agent.lastRunAt} />
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={agent.isActive}
                                onCheckedChange={(checked) => toggleAgentMutation.mutate({ id: agent.id, isActive: checked })}
                                disabled={toggleAgentMutation.isPending || !canActivate || isActivating(`instagram-agent-${agent.id}`)}
                                data-testid={`button-toggle-agent-${agent.id}-mobile`}
                              />
                              <span className="text-xs text-muted-foreground">Ativo</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingReplicadorAgent(agent);
                                  setPersonName(agent.personName || '');
                                  setPersonInstagram(agent.personInstagram || '');
                                  setInstagramUrl(agent.instagramUrl || '');
                                  setWhatsappRecipient(agent.whatsappRecipient || '');
                                  setIsEditReplicadorAgentOpen(true);
                                }}
                                data-testid={`button-edit-agent-${agent.id}-mobile`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (window.confirm('Tem certeza que deseja excluir este agente?')) {
                                    deleteAgentMutation.mutate(agent.id);
                                  }
                                }}
                                disabled={deleteAgentMutation.isPending}
                                data-testid={`button-delete-agent-${agent.id}-mobile`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}


          </TabsContent>

          {/* Agentes Militantes Tab */}
          <TabsContent value="militantes" className="space-y-4">
            {/* Botão para Adicionar Agente */}
            <div className="flex justify-start gap-2">
              <Button
                onClick={() => setIsAddMilitantAgentOpen(true)}
                data-testid="button-open-add-militant-agent"
                variant="outline"
                size="sm"
              >
                <Bot className="h-4 w-4" aria-hidden="true" />
                Adicionar Agente
              </Button>
            </div>

            {/* Removido: lista de instâncias duplicada */}

            {/* Removido: Lista de Instâncias (Clone) não pertence à aba Militantes */}

            {militantAgents.length > 0 && (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block rounded-lg border border-border bg-[#090909] overflow-hidden">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '37%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Nome</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Grupos</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Fluxo</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Status</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {militantAgents.map((agent) => {
                        const groups = JSON.parse(agent.groups || "[]");
                        return (
                          <tr key={agent.id} className="border-b border-border last:border-b-0">
                            <td className="p-3 text-xs border-r border-border truncate" data-testid={`text-agent-name-${agent.id}`}>
                              {agent.name}
                            </td>
                            <td className="p-3 text-xs border-r border-border truncate">{groups.length} grupos</td>
                            <td className="p-3 text-xs border-r border-border" data-testid={`text-agent-flow-${agent.id}`}>
                              {agent.flowMinutes || 10} min
                            </td>
                            <td className="p-3 text-xs border-r border-border">
                              <span className={`font-medium ${agent.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                                {agent.isActive ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2 items-center">
                                <Switch
                                  checked={agent.isActive}
                                  onCheckedChange={(checked) => toggleMilitantAgentMutation.mutate({ id: agent.id, isActive: checked })}
                                  disabled={toggleMilitantAgentMutation.isPending || isActivating(`militant-agent-${agent.id}`)}
                                  data-testid={`button-toggle-${agent.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={async () => {
                                    setManagingGroupsAgent(agent);
                                    setSelectedMilitantGroups(groups);
                                    setIsManageGroupsOpen(true);
                                    
                                    if (agent.wahaUrl && agent.wahaApiKey && agent.wahaSession) {
                                      setIsLoadingMilitantGroups(true);
                                      try {
                                        const groupsResponse = await fetch('/api/waha/fetch-groups', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            wahaUrl: agent.wahaUrl,
                                            wahaApiKey: agent.wahaApiKey,
                                            wahaSession: agent.wahaSession
                                          })
                                        });
                                        const groupsData = await groupsResponse.json();
                                        setAvailableMilitantGroups(groupsData);
                                      } catch (error) {
                                        console.error('Error loading groups:', error);
                                        setAvailableMilitantGroups([]);
                                      } finally {
                                        setIsLoadingMilitantGroups(false);
                                      }
                                    }
                                  }}
                                  data-testid={`button-manage-groups-${agent.id}`}
                                >
                                  <Users className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={async () => {
                                    setEditingMilitantAgent(agent);
                                    setMilitantName(agent.name);
                                    setMilitantSystemPrompt(agent.systemPrompt);
                                    setMilitantFlowMinutes(agent.flowMinutes || 10);
                                    setMilitantMessageCollectionTime(agent.messageCollectionTime || 30);
                                    setMilitantOllamaModel(agent.ollamaModel || "deepseek-v3.1:671b-cloud");
                                    setSelectedMilitantGroups(groups);
                                    
                                    setIsEditMilitantAgentOpen(true);
                                  }}
                                  data-testid={`button-edit-${agent.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => {
                                    if (confirm(`Deseja realmente excluir o agente "${agent.name}"?`)) {
                                      deleteMilitantAgentMutation.mutate(agent.id);
                                    }
                                  }}
                                  disabled={deleteMilitantAgentMutation.isPending}
                                  data-testid={`button-delete-${agent.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {militantAgents.map((agent) => {
                    const groups = JSON.parse(agent.groups || "[]");
                    return (
                      <Card key={agent.id} className="bg-card border-border" data-testid={`card-agent-${agent.id}-mobile`}>
                        <CardContent className="p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-lg" data-testid={`text-agent-name-${agent.id}-mobile`}>
                              {agent.name}
                            </p>
                            <span className={`text-sm font-medium ${agent.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                              {agent.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Grupos: {groups.length} grupos</p>
                            <p data-testid={`text-agent-flow-${agent.id}-mobile`}>Fluxo: {agent.flowMinutes || 10} min</p>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={agent.isActive}
                                onCheckedChange={(checked) => toggleMilitantAgentMutation.mutate({ id: agent.id, isActive: checked })}
                                disabled={toggleMilitantAgentMutation.isPending || isActivating(`militant-agent-${agent.id}`)}
                                data-testid={`button-toggle-${agent.id}-mobile`}
                              />
                              <span className="text-xs text-muted-foreground">Ativo</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  setManagingGroupsAgent(agent);
                                  setSelectedMilitantGroups(groups);
                                  setIsManageGroupsOpen(true);
                                  
                                  if (agent.wahaUrl && agent.wahaApiKey && agent.wahaSession) {
                                    setIsLoadingMilitantGroups(true);
                                    try {
                                      const groupsResponse = await fetch('/api/waha/fetch-groups', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          wahaUrl: agent.wahaUrl,
                                          wahaApiKey: agent.wahaApiKey,
                                          wahaSession: agent.wahaSession
                                        })
                                      });
                                      const groupsData = await groupsResponse.json();
                                      setAvailableMilitantGroups(groupsData);
                                    } catch (error) {
                                      console.error('Error loading groups:', error);
                                      setAvailableMilitantGroups([]);
                                    } finally {
                                      setIsLoadingMilitantGroups(false);
                                    }
                                  }
                                }}
                                data-testid={`button-manage-groups-${agent.id}-mobile`}
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  setEditingMilitantAgent(agent);
                                  setMilitantName(agent.name);
                                  setMilitantSystemPrompt(agent.systemPrompt);
                                  setMilitantFlowMinutes(agent.flowMinutes || 10);
                                  setMilitantMessageCollectionTime(agent.messageCollectionTime || 30);
                                  setMilitantOllamaModel(agent.ollamaModel || "deepseek-v3.1:671b-cloud");
                                  setSelectedMilitantGroups(groups);
                                  
                                  setIsEditMilitantAgentOpen(true);
                                }}
                                data-testid={`button-edit-${agent.id}-mobile`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (confirm(`Deseja realmente excluir o agente "${agent.name}"?`)) {
                                    deleteMilitantAgentMutation.mutate(agent.id);
                                  }
                                }}
                                disabled={deleteMilitantAgentMutation.isPending}
                                data-testid={`button-delete-${agent.id}-mobile`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* Agente Clone Tab */}
          <TabsContent value="clone" className="space-y-4">
            {config && (
              <div className="flex justify-start">
                <Button
                  onClick={() => setIsAddCloneInstanceOpen(true)}
                  aria-label="Abrir modal de Adicionar Agente do Clone"
                  data-testid="button-open-clone-add-instance"
                  variant="outline"
                  size="sm"
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Adicionar Agente
                </Button>
              </div>
            )}

            {/* Card 2 - Instâncias */}
            {/* Lista de Instâncias abaixo da Configuração */}

            {/* Card 3 - Configuração Global (moved to last) */}
            <div className="p-4 bg-[#090909] rounded-lg border border-border space-y-3">
              <Collapsible
                open={openSections.includes('clone-config')}
                onOpenChange={(open) => {
                  setOpenSections(prev =>
                    open
                      ? [...prev, 'clone-config']
                      : prev.filter(key => key !== 'clone-config')
                  );
                }}
              >
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer hover:bg-accent/5 transition-colors p-2 rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold" data-testid="text-clone-config-title">Configuração do Agente Clone</h3>
                        <p className="text-sm text-muted-foreground">Configuração compartilhada por todas as instâncias</p>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                          openSections.includes('clone-config') ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-3">
                {isLoadingConfig ? (
                  <div className="flex items-center justify-center py-8" data-testid="loading-state">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveConfig(); }} className="space-y-4">
                    {/* Configurações Básicas */}
                    <Collapsible
                      open={openSections.includes('clone-config-basic')}
                      onOpenChange={(open) => {
                        setOpenSections(prev =>
                          open
                            ? [...prev, 'clone-config-basic']
                            : prev.filter(key => key !== 'clone-config-basic')
                        );
                      }}
                    >
                      <div className="p-4 bg-[#090909] rounded-lg border border-border">
                        <CollapsibleTrigger asChild>
                          <div className="flex justify-between items-center cursor-pointer hover:bg-accent/5 transition-colors -m-4 p-4 rounded-lg">
                            <div>
                              <h4 className="font-semibold">Configurações Básicas</h4>
                              <p className="text-sm text-muted-foreground">Nome e tempo de coleta</p>
                            </div>
                            <ChevronDown
                              className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                                openSections.includes('clone-config-basic') ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pt-4 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="config-nome">Nome do Agente</Label>
                              <Input
                                id="config-nome"
                                placeholder="Digite o nome do agente"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                data-testid="input-config-nome"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="config-time">Tempo de Coleta (segundos)</Label>
                              <Input
                                id="config-time"
                                type="number"
                                min={1}
                                max={300}
                                placeholder="Tempo em segundos"
                                value={messageCollectionTime}
                                onChange={(e) => setMessageCollectionTime(Number(e.target.value))}
                                data-testid="input-config-time"
                              />
                              <p className="text-xs text-muted-foreground">
                                Tempo em segundos para coletar mensagens antes de responder (1-300)
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="config-delay">Delay antes do Envio (segundos)</Label>
                              <Input
                                id="config-delay"
                                type="number"
                                min={1}
                                max={60}
                                placeholder="Tempo em segundos"
                                value={sendDelaySeconds}
                                onChange={(e) => setSendDelaySeconds(Number(e.target.value))}
                                data-testid="input-config-delay"
                              />
                              <p className="text-xs text-muted-foreground">
                                Tempo de espera antes de enviar a resposta em horário comercial (1-60 segundos)
                              </p>
                            </div>

                            {/* Modelo LLM (movido de "Modelo e Horário") */}
                            <div className="space-y-2">
                              <Label htmlFor="config-model">Modelo LLM</Label>
                              <SimpleSelect value={ollamaModel} onValueChange={setOllamaModel}>
                                <SimpleSelectTrigger id="config-model" data-testid="select-ollama-model">
                                  <SimpleSelectValue placeholder="Selecione o modelo" />
                                </SimpleSelectTrigger>
                                <SimpleSelectContent searchable={false}>
                                  <SimpleSelectItem value="deepseek-v3.1:671b-cloud">deepseek-v3.1:671b-cloud</SimpleSelectItem>
                                  <SimpleSelectItem value="gpt-oss:20b-cloud">gpt-oss:20b-cloud</SimpleSelectItem>
                                  <SimpleSelectItem value="gpt-oss:120b-cloud">gpt-oss:120b-cloud</SimpleSelectItem>
                                  <SimpleSelectItem value="kimi-k2:1t-cloud">kimi-k2:1t-cloud</SimpleSelectItem>
                                  <SimpleSelectItem value="qwen3-coder:480b-cloud">qwen3-coder:480b-cloud</SimpleSelectItem>
                                  <SimpleSelectItem value="glm-4.6:cloud">glm-4.6:cloud</SimpleSelectItem>
                                  <SimpleSelectItem value="minimax-m2:cloud">minimax-m2:cloud</SimpleSelectItem>
                                </SimpleSelectContent>
                              </SimpleSelect>
                              <p className="text-xs text-muted-foreground">
                                Escolha o modelo de IA para gerar respostas
                              </p>
                            </div>

                            {/* Informativo de horário de funcionamento (movido) */}
                            <div className="space-y-2 pt-2 border-t border-border">
                              <p className="text-sm text-muted-foreground">
                                <strong className="text-primary">Horário de funcionamento fixo:</strong> O agente responde normalmente entre <strong>09:00 e 21:00</strong>. Mensagens recebidas fora desse horário serão respondidas a partir das 09:00 com intervalo de 1 minuto entre envios.
                              </p>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Prompt System */}
                    <Collapsible
                      open={openSections.includes('clone-config-prompt')}
                      onOpenChange={(open) => {
                        setOpenSections(prev =>
                          open
                            ? [...prev, 'clone-config-prompt']
                            : prev.filter(key => key !== 'clone-config-prompt')
                        );
                      }}
                    >
                      <div className="p-4 bg-[#090909] rounded-lg border border-border">
                        <CollapsibleTrigger asChild>
                          <div className="flex justify-between items-center cursor-pointer hover:bg-accent/5 transition-colors -m-4 p-4 rounded-lg">
                            <div>
                              <h4 className="font-semibold">Prompt System</h4>
                              <p className="text-sm text-muted-foreground">Instruções de comportamento do agente</p>
                            </div>
                            <ChevronDown
                              className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                                openSections.includes('clone-config-prompt') ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="config-prompt">Prompt System</Label>
                            </div>
                            <Textarea
                              id="config-prompt"
                              placeholder="Digite as instruções de comportamento do agente"
                              value={promptSystem}
                              onChange={(e) => setPromptSystem(e.target.value)}
                              rows={6}
                              data-testid="input-config-prompt"
                              readOnly
                              className="cursor-pointer"
                              onClick={handleOpenPromptEditor}
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>


                    {/* Knowledge Base Section */}
                    {config && (
                      <Collapsible
                        open={openSections.includes('clone-config-knowledge')}
                        onOpenChange={(open) => {
                          setOpenSections(prev =>
                            open
                              ? [...prev, 'clone-config-knowledge']
                              : prev.filter(key => key !== 'clone-config-knowledge')
                          );
                        }}
                      >
                        <div className="p-4 bg-[#090909] rounded-lg border border-border">
                          <CollapsibleTrigger asChild>
                            <div className="flex justify-between items-center cursor-pointer hover:bg-accent/5 transition-colors -m-4 p-4 rounded-lg">
                              <div>
                                <h4 className="font-semibold">Base de Conhecimento</h4>
                                <p className="text-sm text-muted-foreground">Conhecimentos para melhorar as respostas</p>
                              </div>
                              <ChevronDown
                                className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                                  openSections.includes('clone-config-knowledge') ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pt-4 space-y-4">
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Adicione conhecimento..."
                                  value={knowledgeInput}
                                  onChange={(e) => setKnowledgeInput(e.target.value)}
                                  data-testid="input-knowledge"
                                />
                                <Button onClick={handleAddKnowledge} data-testid="button-add-knowledge">
                                  Adicionar
                                </Button>
                              </div>

                              {knowledge.length > 0 && (
                                <div className="border border-border rounded-lg bg-background/50">
                                  <ScrollArea className="h-[340px] w-full">
                                    <div className="space-y-2 p-2">
                                      {knowledge.map((k) => (
                                        <div key={k.id} className="p-3 bg-[#090909] rounded-lg border border-border flex justify-between items-start">
                                          <p className="text-sm flex-1">{k.content}</p>
                                          <Button
                                            onClick={() => deleteKnowledgeMutation.mutate(k.id)}
                                            variant="ghost"
                                            size="sm"
                                            data-testid={`button-delete-knowledge-${k.id}`}
                                          >
                                            Excluir
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}
                    <Button type="submit" data-testid="button-save-config">
                      {config ? "Atualizar Configuração" : "Criar Configuração"}
                    </Button>
                  </form>
                )}
              </div>
                </CollapsibleContent>
              </Collapsible>
              </div>

            {config && (
              <div className="space-y-4">
                {instances.length === 0 ? (
                  <div className="p-4 bg-[#090909] rounded-lg border border-border text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhuma instância configurada. Use o botão "Adicionar Agente" no topo da aba para adicionar uma nova instância.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-lg border border-border bg-[#090909] overflow-hidden">
                      <table className="w-full table-fixed">
                        <colgroup>
                          <col style={{ width: '35%' }} />
                          <col style={{ width: '20%' }} />
                          <col style={{ width: '45%' }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-border">
                            <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Instância</th>
                            <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Status</th>
                            <th className="p-3 text-left text-xs font-bold text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {instances.map((instance) => (
                            <tr key={instance.id} className="border-b border-border last:border-b-0">
                              <td className="p-3 text-xs border-r border-border truncate">{instance.instanceName}</td>
                              <td className="p-3 text-xs border-r border-border">
                                <span className={`font-medium ${instance.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                                  {instance.isActive ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-3 items-center">
                                  <Switch
                                    checked={instance.isActive}
                                    onCheckedChange={(checked) => toggleInstanceMutation.mutate({ id: instance.id, isActive: checked })}
                                    disabled={toggleInstanceMutation.isPending || isActivating(`clone-instance-${instance.id}`)}
                                    data-testid={`button-toggle-instance-${instance.id}`}
                                  />
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingCloneInstanceForDialog(instance);
                                      setEditingInstance({
                                        instanceName: instance.instanceName,
                                        wahaUrl: instance.wahaUrl,
                                        wahaApiKey: instance.wahaApiKey,
                                        wahaSession: instance.wahaSession || ''
                                      });
                                      setIsEditCloneInstanceOpen(true);
                                    }}
                                    data-testid={`button-edit-instance-${instance.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => {
                                      setDeleteTarget({ type: 'clone', id: instance.id });
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    disabled={deleteInstanceMutation.isPending}
                                    data-testid={`button-delete-instance-${instance.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                      {instances.map((instance) => (
                        <Card key={instance.id} className="bg-card border-border" data-testid={`card-instance-${instance.id}-mobile`}>
                          <CardContent className="p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-lg" data-testid={`text-instance-name-${instance.id}-mobile`}>
                                {instance.instanceName}
                              </p>
                              <span className={`text-sm font-medium ${instance.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                                {instance.isActive ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={instance.isActive}
                                  onCheckedChange={(checked) => toggleInstanceMutation.mutate({ id: instance.id, isActive: checked })}
                                  disabled={toggleInstanceMutation.isPending || isActivating(`clone-instance-${instance.id}`)}
                                  data-testid={`button-toggle-instance-${instance.id}-mobile`}
                                />
                                <span className="text-xs text-muted-foreground">Ativo</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingCloneInstanceForDialog(instance);
                                    setEditingInstance({
                                      instanceName: instance.instanceName,
                                      wahaUrl: instance.wahaUrl,
                                      wahaApiKey: instance.wahaApiKey,
                                      wahaSession: instance.wahaSession || ''
                                    });
                                    setIsEditCloneInstanceOpen(true);
                                  }}
                                  data-testid={`button-edit-instance-${instance.id}-mobile`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setDeleteTarget({ type: 'clone', id: instance.id });
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  disabled={deleteInstanceMutation.isPending}
                                  data-testid={`button-delete-instance-${instance.id}-mobile`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* Agente Coletor Tab */}
          <TabsContent value="coletor" className="space-y-4">
            {/* Ações no topo: Instância e Agente lado a lado */}
            <div className="flex justify-start gap-2">
              {!coletorInstance && (
                <Button
                  onClick={() => setIsAddColetorInstanceOpen(true)}
                  aria-label="Abrir modal de Adicionar Agente do Coletor"
                  data-testid="button-open-coletor-add-instance"
                  variant="outline"
                  size="sm"
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Adicionar Agente
                </Button>
              )}
              {coletorInstance && (
                <Button 
                  onClick={() => setIsAddColetorAgentOpen(true)} 
                  data-testid="button-open-add-coletor-agent"
                  variant="outline"
                  size="sm"
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Adicionar Agente
                </Button>
              )}
            </div>
            {/* Instância do Coletor - estilo igual ao Replicador */}
            {coletorInstance && (
              <div className="space-y-4">
                <Collapsible
                  open={openSections.includes(`coletor-instance-${coletorInstance.id}`)}
                  onOpenChange={(open) => {
                    setOpenSections(prev =>
                      open ? [...prev, `coletor-instance-${coletorInstance.id}`] : prev.filter(key => key !== `coletor-instance-${coletorInstance.id}`)
                    );
                  }}
                >
                  <div className="p-4 bg-[#090909] rounded-lg border border-border space-y-3">
                    <div className="flex justify-between items-center p-2 rounded" data-testid={`coletor-instance-card-${coletorInstance.id}`}>
                      <div>
                        <h5 className="font-semibold">{coletorInstance.instanceName}</h5>
                        <p className="text-sm text-muted-foreground">
                          Status: {coletorInstance.isActive ? <span className="text-green-500">Ativo</span> : <span className="text-red-500">Inativo</span>}
                        </p>
                      </div>
                      {editingColetorInstanceId === coletorInstance.id ? null : (
                        <div className="flex gap-3 items-center">
                          <Switch
                            checked={coletorInstance.isActive}
                            onCheckedChange={(checked) => toggleColetorInstanceMutation.mutate({ id: coletorInstance.id, isActive: checked })}
                            disabled={toggleColetorInstanceMutation.isPending || isActivating(`coletor-instance-${coletorInstance.id}`)}
                            data-testid={`button-toggle-coletor-instance-${coletorInstance.id}`}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setEditingColetorInstanceForDialog(coletorInstance);
                              setEditingColetorInstance({
                                instanceName: coletorInstance.instanceName,
                                wahaUrl: coletorInstance.wahaUrl,
                                wahaApiKey: coletorInstance.wahaApiKey,
                                wahaSession: coletorInstance.wahaSession || ""
                              });
                              setIsEditColetorInstanceOpen(true);
                            }}
                            data-testid={`button-edit-coletor-instance-${coletorInstance.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setDeleteTarget({ type: 'coletor', id: coletorInstance.id });
                              setIsDeleteDialogOpen(true);
                            }}
                            disabled={deleteColetorInstanceMutation.isPending}
                            data-testid={`button-delete-coletor-instance-${coletorInstance.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <CollapsibleContent>
                      <div className="pt-3 space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Instância configurada. Use o botão de editar acima para modificar as configurações.
                        </p>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>
            )}


            {/* Active Agents Section - Now in a collapsible card */}
            {!isLoadingCollectorAgents && collectorAgents && collectorAgents.length > 0 && (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block rounded-lg border border-border bg-[#090909] overflow-hidden">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Grupo</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Indicação</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Município</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Status</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground border-r border-border">Próxima Execução</th>
                        <th className="p-3 text-left text-xs font-bold text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectorAgents.map((agent) => {
                        const canActivate = !!coletorInstance && !!coletorInstance.isActive;
                        const isActiveEffective = canActivate ? !!agent.isActive : false;
                        const indicationLabel = (() => {
                          const assessor = assessores.find(a => a.id === agent.indicacao)?.nome;
                          const lider = leaderships.find(l => l.id === agent.indicacao)?.nome;
                          const equipe = teamMembers.find(tm => tm.id === agent.indicacao)?.nome;
                          return assessor || lider || equipe || agent.indicacao || '—';
                        })();
                        return (
                          <tr key={agent.id} className="border-b border-border last:border-b-0">
                            <td className="p-3 text-xs border-r border-border truncate" data-testid={`text-group-${agent.id}`}>
                              {agent.groupName}
                            </td>
                            <td className="p-3 text-xs border-r border-border truncate">{indicationLabel}</td>
                            <td className="p-3 text-xs border-r border-border truncate">{agent.municipio || '—'}</td>
                            <td className="p-3 text-xs border-r border-border">
                              <span className={`font-medium ${isActiveEffective ? 'text-green-600' : 'text-gray-500'}`}>
                                {isActiveEffective ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="p-3 text-xs border-r border-border" data-testid={`text-countdown-${agent.id}`}>
                              {isActiveEffective ? <Countdown lastRunAt={agent.lastRunAt} /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-3 items-center">
                                <Switch
                                  checked={agent.isActive}
                                  onCheckedChange={(checked) => toggleCollectorAgentMutation.mutate({ id: agent.id, isActive: checked })}
                                  disabled={toggleCollectorAgentMutation.isPending || !canActivate || isActivating(`collector-agent-${agent.id}`)}
                                  data-testid={`button-toggle-${agent.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingColetorAgent(agent);
                                    setCollectorGroup(agent.groupId || '');
                                    setCollectorMunicipio(agent.municipio || '');
                                    setCollectorIndicacao(agent.indicacao || '');
                                    setIsEditColetorAgentOpen(true);
                                  }}
                                  data-testid={`button-edit-${agent.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => {
                                    if (window.confirm('Tem certeza que deseja excluir este agente?')) {
                                      deleteCollectorAgentMutation.mutate(agent.id);
                                    }
                                  }}
                                  disabled={deleteCollectorAgentMutation.isPending}
                                  data-testid={`button-delete-${agent.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {collectorAgents.map((agent) => {
                    const canActivate = !!coletorInstance && !!coletorInstance.isActive;
                    const isActiveEffective = canActivate ? !!agent.isActive : false;
                    const indicationLabel = (() => {
                      const assessor = assessores.find(a => a.id === agent.indicacao)?.nome;
                      const lider = leaderships.find(l => l.id === agent.indicacao)?.nome;
                      const equipe = teamMembers.find(tm => tm.id === agent.indicacao)?.nome;
                      return assessor || lider || equipe || agent.indicacao || '—';
                    })();
                    return (
                      <Card key={agent.id} className="bg-card border-border" data-testid={`card-agent-${agent.id}-mobile`}>
                        <CardContent className="p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-lg" data-testid={`text-group-${agent.id}-mobile`}>
                              {agent.groupName}
                            </p>
                            <span className={`text-sm font-medium ${isActiveEffective ? 'text-green-600' : 'text-gray-500'}`}>
                              {isActiveEffective ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Indicação: {indicationLabel}</p>
                            <p>Município: {agent.municipio || '—'}</p>
                            {isActiveEffective && (
                              <p data-testid={`text-countdown-${agent.id}-mobile`}>
                                Próxima: <Countdown lastRunAt={agent.lastRunAt} />
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={agent.isActive}
                                onCheckedChange={(checked) => toggleCollectorAgentMutation.mutate({ id: agent.id, isActive: checked })}
                                disabled={toggleCollectorAgentMutation.isPending || !canActivate || isActivating(`collector-agent-${agent.id}`)}
                                data-testid={`button-toggle-${agent.id}-mobile`}
                              />
                              <span className="text-xs text-muted-foreground">Ativo</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingColetorAgent(agent);
                                  setCollectorGroup(agent.groupId || '');
                                  setCollectorMunicipio(agent.municipio || '');
                                  setCollectorIndicacao(agent.indicacao || '');
                                  setIsEditColetorAgentOpen(true);
                                }}
                                data-testid={`button-edit-${agent.id}-mobile`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (window.confirm('Tem certeza que deseja excluir este agente?')) {
                                    deleteCollectorAgentMutation.mutate(agent.id);
                                  }
                                }}
                                disabled={deleteCollectorAgentMutation.isPending}
                                data-testid={`button-delete-${agent.id}-mobile`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            
          </TabsContent>
        </Tabs>
      </div>

      {/* Modais de Adicionar Agente */}
      <Dialog open={isAddReplicadorInstanceOpen} onOpenChange={setIsAddReplicadorInstanceOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl" aria-label="Modal Adicionar Agente replicador">
          <DialogHeader>
            <DialogTitle>Adicionar Agente (Replicador)</DialogTitle>
            <DialogDescription>Selecione a instância WAHA para vincular</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddReplicadorInstance(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="replicador-instance-name-modal">Nome do Agente</Label>
              <Input
                id="replicador-instance-name-modal"
                placeholder="Nome do agente"
                value={newReplicadorInstance.instanceName}
                onChange={(e) => setNewReplicadorInstance({ ...newReplicadorInstance, instanceName: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Instância WAHA</Label>
              <SimpleSelect value={newReplicadorInstance.wahaSession} onValueChange={(value) => setNewReplicadorInstance({ ...newReplicadorInstance, wahaSession: value })}>
                <SimpleSelectTrigger>
                  <SimpleSelectValue placeholder="Selecione uma instância" />
                </SimpleSelectTrigger>
                <SimpleSelectContent 
                  items={wahaInstances.map(inst => ({ id: inst.name, value: inst.name, label: `${inst.name} (${inst.status})` }))} 
                  emptyMessage="Nenhuma instância encontrada. Crie uma na página Instâncias."
                />
              </SimpleSelect>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" aria-label="Cancelar Adicionar Agente">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={createReplicadorInstanceMutation.isPending || !newReplicadorInstance.wahaSession} aria-label="Confirmar Adicionar Agente">
                {createReplicadorInstanceMutation.isPending ? "Adicionando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Instância Replicador */}
      <Dialog open={isEditReplicadorInstanceOpen} onOpenChange={(open) => {
        setIsEditReplicadorInstanceOpen(open);
        if (!open) {
          setEditingReplicadorInstanceForDialog(null);
          setEditingReplicadorInstance({ instanceName: "", wahaSession: "" });
        }
      }}>
        <DialogContent className="max-w-xl" aria-label="Modal Editar Instância Replicador">
          <DialogHeader>
            <DialogTitle>Editar Agente (Replicador)</DialogTitle>
            <DialogDescription>Atualize as configurações do agente</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingReplicadorInstanceForDialog) return;

            if (!editingReplicadorInstance.instanceName.trim() || !editingReplicadorInstance.wahaSession.trim()) {
              return;
            }

            updateReplicadorInstanceMutation.mutate({
              id: editingReplicadorInstanceForDialog.id,
              instanceName: editingReplicadorInstance.instanceName.trim(),
              wahaSession: editingReplicadorInstance.wahaSession.trim(),
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-replicador-instance-name">Nome do Agente</Label>
              <Input
                id="edit-replicador-instance-name"
                value={editingReplicadorInstance.instanceName}
                onChange={(e) => setEditingReplicadorInstance({...editingReplicadorInstance, instanceName: e.target.value})}
                placeholder="Nome do agente"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Instância WAHA</Label>
              <SimpleSelect value={editingReplicadorInstance.wahaSession} onValueChange={(value) => setEditingReplicadorInstance({...editingReplicadorInstance, wahaSession: value})}>
                <SimpleSelectTrigger>
                  <SimpleSelectValue placeholder="Selecione uma instância" />
                </SimpleSelectTrigger>
                <SimpleSelectContent 
                  items={wahaInstances.map(inst => ({ id: inst.name, value: inst.name, label: `${inst.name} (${inst.status})` }))} 
                  emptyMessage="Nenhuma instância encontrada. Crie uma na página Instâncias."
                />
              </SimpleSelect>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={updateReplicadorInstanceMutation.isPending || !editingReplicadorInstance.wahaSession}>
                {updateReplicadorInstanceMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCloneInstanceOpen} onOpenChange={setIsAddCloneInstanceOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl" aria-label="Modal Adicionar Agente clone">
          <DialogHeader>
            <DialogTitle>Adicionar Agente</DialogTitle>
            <DialogDescription>Selecione a instância WAHA para vincular</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddInstance(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="clone-instance-name-modal">Nome do Agente</Label>
              <Input
                id="clone-instance-name-modal"
                placeholder="Nome do agente"
                value={newInstance.instanceName}
                onChange={(e) => setNewInstance({ ...newInstance, instanceName: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Instância WAHA</Label>
              <SimpleSelect value={newInstance.wahaSession} onValueChange={(value) => setNewInstance({ ...newInstance, wahaSession: value })}>
                <SimpleSelectTrigger>
                  <SimpleSelectValue placeholder="Selecione uma instância" />
                </SimpleSelectTrigger>
                <SimpleSelectContent 
                  items={wahaInstances.map(inst => ({ id: inst.name, value: inst.name, label: `${inst.name} (${inst.status})` }))} 
                  emptyMessage="Nenhuma instância encontrada. Crie uma na página Instâncias."
                />
              </SimpleSelect>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" aria-label="Cancelar Adicionar Agente">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={createInstanceMutation.isPending || !newInstance.wahaSession} aria-label="Confirmar Adicionar Agente">
                {createInstanceMutation.isPending ? "Adicionando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddColetorInstanceOpen} onOpenChange={setIsAddColetorInstanceOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl" aria-label="Modal Adicionar Agente">
          <DialogHeader>
            <DialogTitle>Adicionar Agente (Coletor)</DialogTitle>
            <DialogDescription>Selecione a instância WAHA para vincular</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddColetorInstance(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="coletor-instance-name-modal">Nome do Agente</Label>
              <Input
                id="coletor-instance-name-modal"
                placeholder="Nome do agente"
                value={newColetorInstance.instanceName}
                onChange={(e) => setNewColetorInstance({ ...newColetorInstance, instanceName: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Instância WAHA</Label>
              <SimpleSelect value={newColetorInstance.wahaSession} onValueChange={(value) => setNewColetorInstance({ ...newColetorInstance, wahaSession: value })}>
                <SimpleSelectTrigger>
                  <SimpleSelectValue placeholder="Selecione uma instância" />
                </SimpleSelectTrigger>
                <SimpleSelectContent 
                  items={wahaInstances.map(inst => ({ id: inst.name, value: inst.name, label: `${inst.name} (${inst.status})` }))} 
                  emptyMessage="Nenhuma instância encontrada. Crie uma na página Instâncias."
                />
              </SimpleSelect>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" aria-label="Cancelar Adicionar Agente">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={createColetorInstanceMutation.isPending || !newColetorInstance.wahaSession} aria-label="Confirmar Adicionar Agente">
                {createColetorInstanceMutation.isPending ? "Adicionando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Instância Coletor */}
      <Dialog open={isEditColetorInstanceOpen} onOpenChange={(open) => {
        setIsEditColetorInstanceOpen(open);
        if (!open) {
          setEditingColetorInstanceForDialog(null);
          setEditingColetorInstance({ instanceName: "", wahaSession: "" });
        }
      }}>
        <DialogContent className="max-w-xl" aria-label="Modal Editar Instância Coletor">
          <DialogHeader>
            <DialogTitle>Editar Agente (Coletor)</DialogTitle>
            <DialogDescription>Atualize as configurações do agente</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingColetorInstanceForDialog) return;

            if (!editingColetorInstance.instanceName.trim() || !editingColetorInstance.wahaSession.trim()) {
              return;
            }

            updateColetorInstanceMutation.mutate({
              id: editingColetorInstanceForDialog.id,
              instanceName: editingColetorInstance.instanceName.trim(),
              wahaSession: editingColetorInstance.wahaSession.trim(),
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-coletor-instance-name">Nome do Agente</Label>
              <Input
                id="edit-coletor-instance-name"
                value={editingColetorInstance.instanceName}
                onChange={(e) => setEditingColetorInstance({...editingColetorInstance, instanceName: e.target.value})}
                placeholder="Nome do agente"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Instância WAHA</Label>
              <SimpleSelect value={editingColetorInstance.wahaSession} onValueChange={(value) => setEditingColetorInstance({...editingColetorInstance, wahaSession: value})}>
                <SimpleSelectTrigger>
                  <SimpleSelectValue placeholder="Selecione uma instância" />
                </SimpleSelectTrigger>
                <SimpleSelectContent 
                  items={wahaInstances.map(inst => ({ id: inst.name, value: inst.name, label: `${inst.name} (${inst.status})` }))} 
                  emptyMessage="Nenhuma instância encontrada. Crie uma na página Instâncias."
                />
              </SimpleSelect>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={updateColetorInstanceMutation.isPending || !editingColetorInstance.wahaSession}>
                {updateColetorInstanceMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Prompt Editor Dialog */}
      <Dialog open={isPromptEditorOpen} onOpenChange={setIsPromptEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editor de Prompt System</DialogTitle>
            <DialogDescription>
              Edite as instruções de comportamento do agente clone. As alterações serão salvas automaticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-editor-textarea">Prompt System</Label>
              <Textarea
                ref={textareaRef}
                id="prompt-editor-textarea"
                placeholder="Digite as instruções de comportamento do agente..."
                value={tempPromptSystem}
                onChange={(e) => setTempPromptSystem(e.target.value)}
                rows={15}
                className="text-sm resize-y min-h-[300px]"
                data-testid="textarea-prompt-editor"
                disabled={updateConfigMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClosePromptEditor}
              data-testid="button-cancel-prompt-editor"
              disabled={updateConfigMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSavePromptEditor}
              data-testid="button-save-prompt-editor"
              disabled={updateConfigMutation.isPending}
            >
              {updateConfigMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md" aria-label="Modal de confirmação de exclusão">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta instância?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" data-testid="button-cancel-delete" aria-label="Cancelar exclusão">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={!isDeleteConfirmEnabled || (deleteTarget?.type === 'clone' ? deleteInstanceMutation.isPending : deleteTarget?.type === 'replicador' ? deleteReplicadorInstanceMutation.isPending : deleteTarget?.type === 'coletor' ? deleteColetorInstanceMutation.isPending : false)}
              data-testid="button-confirm-delete"
              aria-label="Confirmar exclusão"
            >
              {(deleteTarget?.type === 'clone' ? deleteInstanceMutation.isPending : deleteTarget?.type === 'replicador' ? deleteReplicadorInstanceMutation.isPending : deleteTarget?.type === 'coletor' ? deleteColetorInstanceMutation.isPending : false)
                ? 'Excluindo...'
                : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Agente Replicador */}
      <Dialog open={isAddReplicadorAgentOpen} onOpenChange={setIsAddReplicadorAgentOpen}>
        <DialogContent className="max-w-xl" aria-label="Modal Adicionar Agente">
          <DialogHeader>
            <DialogTitle>Adicionar Agente</DialogTitle>
            <DialogDescription>Configure o agente para monitorar e replicar posts</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-person-name">Nome</Label>
              <Input id="modal-person-name" type="text" placeholder="Seu nome..." value={personName} onChange={(e) => setPersonName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-person-instagram">Instagram</Label>
              <Input id="modal-person-instagram" type="url" placeholder="https://www.instagram.com/..." value={personInstagram} onChange={(e) => setPersonInstagram(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-instagram-url">URL para Monitorar</Label>
              <Input id="modal-instagram-url" type="url" placeholder="https://www.instagram.com/..." value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-whatsapp-group">Grupo do WhatsApp</Label>
              <SimpleSelect value={whatsappRecipient} onValueChange={setWhatsappRecipient} disabled={isLoadingReplicadorGroups || replicadorGroups.length === 0}>
                <SimpleSelectTrigger id="modal-whatsapp-group" className="w-full">
                  <SimpleSelectValue placeholder={isLoadingReplicadorGroups ? 'Carregando grupos...' : replicadorGroups.length === 0 ? 'Nenhum grupo disponível' : 'Selecione um grupo'} />
                </SimpleSelectTrigger>
                <SimpleSelectContent items={replicadorGroups.map(group => ({ id: group.id, value: group.id, label: group.name }))} emptyMessage="Nenhum grupo encontrado. Verifique sua instância WAHA."></SimpleSelectContent>
              </SimpleSelect>
              {replicadorGroupsError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive font-medium">{replicadorGroupsError}</p>
                </div>
              )}
              {replicadorGroups.length === 0 && !isLoadingReplicadorGroups && !replicadorGroupsError && (
                <p className="text-xs text-muted-foreground">Conecte sua instância do WhatsApp e certifique-se de que ela está em grupos.</p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={createAgentMutation.isPending}>{createAgentMutation.isPending ? 'Configurando...' : 'Adicionar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Agente */}
      <Dialog open={isAddColetorAgentOpen} onOpenChange={setIsAddColetorAgentOpen}>
        <DialogContent className="max-w-xl" aria-label="Modal Adicionar Agente">
          <DialogHeader>
            <DialogTitle>Adicionar Agente</DialogTitle>
            <DialogDescription>Monitora grupos do WhatsApp e cadastra novos membros automaticamente</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!collectorGroup || !collectorIndicacao || !collectorMunicipio) {
              return;
            }
            
            const selectedGroup = coletorGroups.find(g => g.id === collectorGroup);
            if (!selectedGroup) {
              return;
            }

            createCollectorAgentMutation.mutate({
              groupId: collectorGroup,
              groupName: selectedGroup.name,
              indicacao: collectorIndicacao,
              municipio: collectorMunicipio,
              bairro: collectorBairro || "",
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-collector-group">Grupo do WhatsApp</Label>
              <SimpleSelect 
                value={collectorGroup} 
                onValueChange={setCollectorGroup}
                disabled={isLoadingColetorGroups || coletorGroups.length === 0}
              >
                <SimpleSelectTrigger id="modal-collector-group" data-testid="select-collector-group-modal" className="w-full">
                  <SimpleSelectValue placeholder={
                    isLoadingColetorGroups 
                      ? "Carregando grupos..." 
                      : coletorGroups.length === 0 
                      ? "Nenhum grupo disponível" 
                      : "Selecione um grupo"
                  } />
                </SimpleSelectTrigger>
                <SimpleSelectContent
                  items={coletorGroups.map(group => ({
                    id: group.id,
                    value: group.id,
                    label: group.name
                  }))}
                  emptyMessage="Nenhum grupo encontrado. Verifique se sua instância do WhatsApp está conectada e possui grupos."
                />
              </SimpleSelect>
              {coletorGroups.length === 0 && !isLoadingColetorGroups && (
                <p className="text-xs text-muted-foreground">
                  Conecte sua instância do WhatsApp e certifique-se de que ela está em grupos para poder selecionar.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-collector-indicacao">Indicação</Label>
              <ScrollableSelect value={collectorIndicacao} onValueChange={setCollectorIndicacao}>
                <ScrollableSelectTrigger id="modal-collector-indicacao" data-testid="select-collector-indicacao-modal">
                  <ScrollableSelectValue placeholder="Selecione a indicação" />
                </ScrollableSelectTrigger>
                <ScrollableSelectContent items={teamMembers} placeholder="Buscar..." />
              </ScrollableSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-collector-municipio">Município</Label>
              <ScrollableSelect 
                value={collectorMunicipio} 
                onValueChange={(value) => {
                  setCollectorMunicipio(value);
                  setCollectorBairro("");
                }}
              >
                <ScrollableSelectTrigger id="modal-collector-municipio" data-testid="select-collector-municipio-modal">
                  <ScrollableSelectValue placeholder="Selecione o município" />
                </ScrollableSelectTrigger>
                <ScrollableSelectContent items={municipioOptions} placeholder="Buscar..." />
              </ScrollableSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-collector-bairro">Bairro (opcional)</Label>
              <ScrollableSelect 
                value={collectorBairro} 
                onValueChange={setCollectorBairro}
                disabled={!collectorMunicipio}
              >
                <ScrollableSelectTrigger id="modal-collector-bairro" data-testid="select-collector-bairro-modal">
                  <ScrollableSelectValue placeholder={
                    !collectorMunicipio 
                      ? "Selecione um município primeiro" 
                      : "Selecione o bairro (opcional)"
                  } />
                </ScrollableSelectTrigger>
                <ScrollableSelectContent items={bairroOptions} placeholder="Buscar..." />
              </ScrollableSelect>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button 
                type="submit"
                disabled={createCollectorAgentMutation.isPending}
                data-testid="button-create-collector-agent-modal"
              >
                {createCollectorAgentMutation.isPending ? "Configurando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Agente Coletor */}
      <Dialog open={isEditColetorAgentOpen} onOpenChange={(open) => {
        setIsEditColetorAgentOpen(open);
        if (!open) {
          setEditingColetorAgent(null);
          setCollectorGroup('');
          setCollectorMunicipio('');
          setCollectorIndicacao('');
        }
      }}>
        <DialogContent className="max-w-xl" aria-label="Modal Editar Agente Coletor">
          <DialogHeader>
            <DialogTitle>Editar Agente Coletor</DialogTitle>
            <DialogDescription>Atualize as configurações do agente coletor</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingColetorAgent) return;

            if (!collectorGroup.trim() || !collectorMunicipio.trim() || !collectorIndicacao.trim()) {
              return;
            }

            updateCollectorAgentMutation.mutate({
              id: editingColetorAgent.id,
              groupId: collectorGroup,
              municipio: collectorMunicipio,
              indicacao: collectorIndicacao,
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-collector-group">Grupo do WhatsApp</Label>
              <SimpleSelect 
                value={collectorGroup} 
                onValueChange={setCollectorGroup}
                disabled={isLoadingColetorGroups || coletorGroups.length === 0}
              >
                <SimpleSelectTrigger id="edit-collector-group" className="w-full">
                  <SimpleSelectValue placeholder={isLoadingColetorGroups ? 'Carregando grupos...' : coletorGroups.length === 0 ? 'Nenhum grupo disponível' : 'Selecione um grupo'} />
                </SimpleSelectTrigger>
                <SimpleSelectContent items={coletorGroups.map(group => ({ id: group.id, value: group.id, label: group.name }))} emptyMessage="Nenhum grupo encontrado. Verifique sua instância WAHA."></SimpleSelectContent>
              </SimpleSelect>
              {coletorGroupsError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive font-medium">{coletorGroupsError}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-collector-indicacao">Indicação</Label>
              <ScrollableSelect value={collectorIndicacao} onValueChange={setCollectorIndicacao}>
                <ScrollableSelectTrigger id="edit-collector-indicacao">
                  <ScrollableSelectValue placeholder="Selecione a indicação" />
                </ScrollableSelectTrigger>
                <ScrollableSelectContent items={teamMembers} placeholder="Buscar..." />
              </ScrollableSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-collector-municipio">Município</Label>
              <ScrollableSelect 
                value={collectorMunicipio} 
                onValueChange={setCollectorMunicipio}
              >
                <ScrollableSelectTrigger id="edit-collector-municipio">
                  <ScrollableSelectValue placeholder="Selecione o município" />
                </ScrollableSelectTrigger>
                <ScrollableSelectContent items={municipioOptions} placeholder="Buscar..." />
              </ScrollableSelect>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={updateCollectorAgentMutation.isPending}>
                {updateCollectorAgentMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Agente Militante */}
      <Dialog open={isAddMilitantAgentOpen} onOpenChange={(open) => {
        setIsAddMilitantAgentOpen(open);
        if (!open) {
          setWizardCurrentStep(1);
          setWizardData({
            name: "",
            systemPrompt: "",
            wahaSession: ""
          });
          setSelectedMilitantGroups([]);
          setAvailableMilitantGroups([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-label="Modal Adicionar Agente Militante">
          <DialogHeader>
            <DialogTitle>Adicionar Agente Militante</DialogTitle>
            <DialogDescription>Configure um agente para responder em grupos do WhatsApp</DialogDescription>
          </DialogHeader>
          
          {isLoadingMilitantAgents ? (
            <div className="flex items-center justify-center py-8" data-testid="loading-state">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Indicator */}
              <div className="flex items-center justify-center gap-2">
                {[1, 2].map((step) => (
                  <div key={step} className="flex items-center">
                    <div 
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold transition-colors ${
                        wizardCurrentStep === step 
                          ? 'border-primary bg-primary text-primary-foreground' 
                          : wizardCurrentStep > step
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-muted bg-muted text-muted-foreground'
                      }`}
                      data-testid={`wizard-step-indicator-${step}`}
                    >
                      {step}
                    </div>
                    {step < 2 && (
                      <div className={`w-12 h-0.5 ${wizardCurrentStep > step ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Step 1: Basic Information */}
              {wizardCurrentStep === 1 && (
                <div className="space-y-4" data-testid="wizard-step-1">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold">Informações Básicas</h3>
                    <p className="text-sm text-muted-foreground">Configure o nome e prompt do agente</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="wizard-militant-name">Nome do Agente *</Label>
                    <Input
                      id="wizard-militant-name"
                      placeholder="Ex: Agente Campinas"
                      value={wizardData.name}
                      onChange={(e) => setWizardData({...wizardData, name: e.target.value})}
                      data-testid="input-wizard-militant-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="wizard-militant-prompt">Prompt do Sistema *</Label>
                    <Textarea
                      id="wizard-militant-prompt"
                      placeholder="Você é um apoiador entusiasmado..."
                      value={wizardData.systemPrompt}
                      onChange={(e) => setWizardData({...wizardData, systemPrompt: e.target.value})}
                      rows={6}
                      data-testid="input-wizard-militant-prompt"
                    />
                  </div>

                  <div className="flex justify-between gap-2 pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" data-testid="button-wizard-cancel-step1">
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={() => {
                        if (!wizardData.name.trim()) {
                          return;
                        }
                        if (!wizardData.systemPrompt.trim()) {
                          return;
                        }
                        setWizardCurrentStep(2);
                      }}
                      data-testid="button-wizard-next-step1"
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: WAHA Instance Selection + Group Selection */}
              {wizardCurrentStep === 2 && (
                <div className="space-y-4" data-testid="wizard-step-2">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold">Instância WAHA e Grupos</h3>
                    <p className="text-sm text-muted-foreground">Selecione a instância WAHA e os grupos</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Instância WAHA *</Label>
                    <SimpleSelect 
                      value={wizardData.wahaSession} 
                      onValueChange={async (value) => {
                        setWizardData({...wizardData, wahaSession: value});
                        setIsVerifyingWaha(true);
                        try {
                          const groupsResponse = await apiRequest("/api/waha/fetch-groups-by-instance", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ instanceName: value })
                          });
                          const groupsData = await groupsResponse.json();
                          setAvailableMilitantGroups(groupsData);
                        } catch (error) {
                          console.error('Error fetching groups:', error);
                          setAvailableMilitantGroups([]);
                        } finally {
                          setIsVerifyingWaha(false);
                        }
                      }}
                    >
                      <SimpleSelectTrigger>
                        <SimpleSelectValue placeholder="Selecione uma instância" />
                      </SimpleSelectTrigger>
                      <SimpleSelectContent 
                        items={wahaInstances.map(inst => ({ id: inst.name, value: inst.name, label: `${inst.name} (${inst.status})` }))} 
                        emptyMessage="Nenhuma instância encontrada. Crie uma na página Instâncias."
                      />
                    </SimpleSelect>
                  </div>

                  {isVerifyingWaha ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : wizardData.wahaSession && (
                    <>
                      <div className="text-center mt-4">
                        <p className="text-sm text-muted-foreground">
                          {selectedMilitantGroups.length > 0 
                            ? `${selectedMilitantGroups.length} grupo(s) selecionado(s)`
                            : 'Selecione os grupos onde o agente irá atuar'
                          }
                        </p>
                      </div>

                      {availableMilitantGroups.length > 0 ? (
                        <ScrollArea className="h-[250px] rounded-md border border-border p-4">
                          <div className="space-y-3">
                            {availableMilitantGroups.map((group) => {
                              const isSelected = selectedMilitantGroups.some(g => g.id === group.id);
                              return (
                                <div 
                                  key={group.id} 
                                  className="flex items-start space-x-3 p-3 rounded-md border border-border bg-background hover:bg-accent/10 transition-colors"
                                >
                                  <Checkbox
                                    id={`wizard-group-${group.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked: boolean) => {
                                      if (checked) {
                                        setSelectedMilitantGroups(prev => [
                                          ...prev,
                                          { id: group.id, name: group.name, active: true }
                                        ]);
                                      } else {
                                        setSelectedMilitantGroups(prev => 
                                          prev.filter(g => g.id !== group.id)
                                        );
                                      }
                                    }}
                                    data-testid={`checkbox-wizard-group-${group.id}`}
                                  />
                                  <Label
                                    htmlFor={`wizard-group-${group.id}`}
                                    className="flex-1 cursor-pointer text-sm font-normal"
                                  >
                                    <div className="font-medium text-white dark:text-white">{group.name}</div>
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>Nenhum grupo encontrado para esta instância.</p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-between gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setWizardCurrentStep(1)}
                      data-testid="button-wizard-back-step2"
                    >
                      Voltar
                    </Button>
                    <Button
                      onClick={() => {
                        createMilitantAgentMutation.mutate({
                          name: wizardData.name,
                          systemPrompt: wizardData.systemPrompt,
                          groups: JSON.stringify(selectedMilitantGroups),
                          wahaSession: wizardData.wahaSession
                        });
                      }}
                      disabled={createMilitantAgentMutation.isPending || !wizardData.wahaSession}
                      data-testid="button-wizard-create-agent"
                    >
                      {createMilitantAgentMutation.isPending ? "Criando..." : "Criar Agente"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Gerenciar Grupos */}
      <Dialog open={isManageGroupsOpen} onOpenChange={(open) => {
        setIsManageGroupsOpen(open);
        if (!open) {
          setManagingGroupsAgent(null);
          setSelectedMilitantGroups([]);
          setAvailableMilitantGroups([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-label="Modal Gerenciar Grupos">
          <DialogHeader>
            <DialogTitle>Gerenciar Grupos - {managingGroupsAgent?.name}</DialogTitle>
            <DialogDescription>
              {selectedMilitantGroups.length > 0 
                ? `${selectedMilitantGroups.length} grupo(s) selecionado(s)`
                : 'Selecione os grupos onde o agente irá atuar'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {isLoadingMilitantGroups ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : availableMilitantGroups.length > 0 ? (
              <ScrollArea className="h-[400px] rounded-md border border-border p-4">
                <div className="space-y-3">
                  {availableMilitantGroups.map((group) => {
                    const isSelected = selectedMilitantGroups.some(g => g.id === group.id);
                    return (
                      <div 
                        key={group.id} 
                        className="flex items-start space-x-3 p-3 rounded-md border border-border bg-background hover:bg-accent/10 transition-colors"
                      >
                        <Checkbox
                          id={`manage-group-${group.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedMilitantGroups(prev => [
                                ...prev,
                                { id: group.id, name: group.name, active: true }
                              ]);
                            } else {
                              setSelectedMilitantGroups(prev => 
                                prev.filter(g => g.id !== group.id)
                              );
                            }
                          }}
                          data-testid={`checkbox-manage-group-${group.id}`}
                        />
                        <Label
                          htmlFor={`manage-group-${group.id}`}
                          className="flex-1 cursor-pointer text-sm font-normal"
                        >
                          <div className="font-medium text-white dark:text-white">{group.name}</div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum grupo encontrado. Configure as credenciais WAHA para carregar os grupos.</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button 
              onClick={() => {
                if (!managingGroupsAgent) return;
                updateMilitantAgentGroupsMutation.mutate({
                  id: managingGroupsAgent.id,
                  groups: selectedMilitantGroups
                });
              }}
              disabled={updateMilitantAgentGroupsMutation.isPending}
              data-testid="button-save-groups"
            >
              {updateMilitantAgentGroupsMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Agente Militante */}
      <Dialog open={isEditMilitantAgentOpen} onOpenChange={(open) => {
        setIsEditMilitantAgentOpen(open);
        if (!open) {
          setEditingMilitantAgent(null);
          setMilitantName("");
          setMilitantSystemPrompt("");
          setMilitantFlowMinutes(10);
          setMilitantMessageCollectionTime(30);
          setMilitantOllamaModel("deepseek-v3.1:671b-cloud");
          setSelectedMilitantGroups([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-label="Modal Editar Agente Militante">
          <DialogHeader>
            <DialogTitle>Editar Agente Militante</DialogTitle>
            <DialogDescription>Atualize as configurações do agente</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingMilitantAgent) return;
            
            if (!militantName.trim()) {
              return;
            }
            if (!militantSystemPrompt.trim()) {
              return;
            }

            updateMilitantAgentMutation.mutate({
              id: editingMilitantAgent.id,
              name: militantName,
              systemPrompt: militantSystemPrompt,
              wahaSession: editingMilitantAgent.wahaSession || "",
              flowMinutes: militantFlowMinutes,
              messageCollectionTime: militantMessageCollectionTime,
              ollamaModel: militantOllamaModel,
              groups: JSON.stringify(selectedMilitantGroups)
            });
          }} className="space-y-4">
            
            {/* Informações Básicas */}
            <Collapsible
              open={openSections.includes('edit-militant-basic')}
              onOpenChange={(open) => {
                setOpenSections(prev =>
                  open
                    ? [...prev, 'edit-militant-basic']
                    : prev.filter(key => key !== 'edit-militant-basic')
                );
              }}
            >
              <div className="p-4 bg-[#090909] rounded-lg border border-border">
                <CollapsibleTrigger asChild>
                  <div className="flex justify-between items-center cursor-pointer hover:bg-accent/5 transition-colors -m-4 p-4 rounded-lg">
                    <div>
                      <h4 className="font-semibold">Informações Básicas</h4>
                      <p className="text-sm text-muted-foreground">Nome, tempo de fluxo e modelo LLM</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                        openSections.includes('edit-militant-basic') ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-militant-name">Nome do Agente *</Label>
                      <Input
                        id="edit-militant-name"
                        placeholder="Ex: Agente Campinas"
                        value={militantName}
                        onChange={(e) => setMilitantName(e.target.value)}
                        data-testid="input-edit-militant-name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-militant-flow">Fluxo (minutos) *</Label>
                      <Input
                        id="edit-militant-flow"
                        type="number"
                        min={1}
                        max={1440}
                        placeholder="10"
                        value={militantFlowMinutes}
                        onChange={(e) => setMilitantFlowMinutes(Number(e.target.value))}
                        data-testid="input-edit-militant-flow"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Tempo em minutos que o agente aguarda antes de responder novamente no mesmo grupo (1-1440 minutos)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-militant-collection-time">Tempo de Coleta (segundos) *</Label>
                      <Input
                        id="edit-militant-collection-time"
                        type="number"
                        min={10}
                        max={300}
                        placeholder="30"
                        value={militantMessageCollectionTime}
                        onChange={(e) => setMilitantMessageCollectionTime(Number(e.target.value))}
                        data-testid="input-edit-militant-collection-time"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Tempo em segundos que o agente aguarda para coletar mensagens antes de gerar resposta (10-300 segundos)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-militant-model">Modelo LLM</Label>
                      <SimpleSelect value={militantOllamaModel} onValueChange={setMilitantOllamaModel}>
                        <SimpleSelectTrigger id="edit-militant-model" data-testid="select-edit-militant-model">
                          <SimpleSelectValue placeholder="Selecione o modelo" />
                        </SimpleSelectTrigger>
                        <SimpleSelectContent searchable={false}>
                          <SimpleSelectItem value="deepseek-v3.1:671b-cloud">deepseek-v3.1:671b-cloud</SimpleSelectItem>
                          <SimpleSelectItem value="gpt-oss:20b-cloud">gpt-oss:20b-cloud</SimpleSelectItem>
                          <SimpleSelectItem value="gpt-oss:120b-cloud">gpt-oss:120b-cloud</SimpleSelectItem>
                          <SimpleSelectItem value="kimi-k2:1t-cloud">kimi-k2:1t-cloud</SimpleSelectItem>
                          <SimpleSelectItem value="qwen3-coder:480b-cloud">qwen3-coder:480b-cloud</SimpleSelectItem>
                          <SimpleSelectItem value="glm-4.6:cloud">glm-4.6:cloud</SimpleSelectItem>
                        </SimpleSelectContent>
                      </SimpleSelect>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Prompt do Sistema */}
            <Collapsible
              open={openSections.includes('edit-militant-prompt')}
              onOpenChange={(open) => {
                setOpenSections(prev =>
                  open
                    ? [...prev, 'edit-militant-prompt']
                    : prev.filter(key => key !== 'edit-militant-prompt')
                );
              }}
            >
              <div className="p-4 bg-[#090909] rounded-lg border border-border">
                <CollapsibleTrigger asChild>
                  <div className="flex justify-between items-center cursor-pointer hover:bg-accent/5 transition-colors -m-4 p-4 rounded-lg">
                    <div>
                      <h4 className="font-semibold">Prompt do Sistema</h4>
                      <p className="text-sm text-muted-foreground">Instruções de comportamento do agente</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                        openSections.includes('edit-militant-prompt') ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-4 space-y-2">
                    <Textarea
                      id="edit-militant-prompt"
                      placeholder="Você é um apoiador entusiasmado..."
                      value={militantSystemPrompt}
                      rows={8}
                      data-testid="input-edit-militant-prompt"
                      readOnly
                      className="cursor-pointer"
                      onClick={handleOpenMilitantPromptEditor}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Instância WAHA */}
            <div className="p-4 bg-[#090909] rounded-lg border border-border">
              <div className="space-y-2">
                <Label>Instância WAHA</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Instância atual: {editingMilitantAgent?.wahaSession || "Nenhuma"}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button 
                type="submit"
                disabled={updateMilitantAgentMutation.isPending}
                data-testid="button-update-militant-agent"
              >
                {updateMilitantAgentMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Militant Prompt Editor Dialog */}
      <Dialog open={isMilitantPromptEditorOpen} onOpenChange={setIsMilitantPromptEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editor de Prompt do Sistema</DialogTitle>
            <DialogDescription>
              {editingMilitantAgent 
                ? "Edite as instruções de comportamento do agente militante. As alterações serão salvas automaticamente."
                : "Edite as instruções de comportamento do agente militante. Clique em 'Aplicar' para adicionar ao formulário."
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="militant-prompt-editor-textarea">Prompt do Sistema</Label>
              <Textarea
                id="militant-prompt-editor-textarea"
                placeholder="Digite as instruções de comportamento do agente militante..."
                value={tempMilitantSystemPrompt}
                onChange={(e) => setTempMilitantSystemPrompt(e.target.value)}
                rows={15}
                className="text-sm resize-y min-h-[300px]"
                data-testid="textarea-militant-prompt-editor"
                disabled={!!editingMilitantAgent && updateMilitantAgentMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseMilitantPromptEditor}
              data-testid="button-cancel-militant-prompt-editor"
              disabled={!!editingMilitantAgent && updateMilitantAgentMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveMilitantPromptEditor}
              data-testid="button-save-militant-prompt-editor"
              disabled={!!editingMilitantAgent && updateMilitantAgentMutation.isPending}
            >
              {editingMilitantAgent 
                ? (updateMilitantAgentMutation.isPending ? "Salvando..." : "Salvar")
                : "Aplicar ao Formulário"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Agente Replicador */}
      <Dialog open={isEditReplicadorAgentOpen} onOpenChange={(open) => {
        setIsEditReplicadorAgentOpen(open);
        if (!open) {
          setEditingReplicadorAgent(null);
          setPersonName("");
          setPersonInstagram("");
          setInstagramUrl("");
          setWhatsappRecipient("");
        }
      }}>
        <DialogContent className="max-w-xl" aria-label="Modal Editar Agente Replicador">
          <DialogHeader>
            <DialogTitle>Editar Agente</DialogTitle>
            <DialogDescription>Atualize as configurações do agente de monitoramento e replicação</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingReplicadorAgent) return;

            if (!personName.trim() || !personInstagram.trim() || !instagramUrl.trim() || !whatsappRecipient) {
              return;
            }

            updateAgentMutation.mutate({
              id: editingReplicadorAgent.id,
              data: {
                personName: personName.trim(),
                personInstagram: personInstagram.trim(),
                instagramUrl: instagramUrl.trim(),
                whatsappRecipient: whatsappRecipient,
              }
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-person-name">Nome</Label>
              <Input 
                id="edit-person-name" 
                type="text" 
                placeholder="Seu nome..." 
                value={personName} 
                onChange={(e) => setPersonName(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-person-instagram">Instagram</Label>
              <Input 
                id="edit-person-instagram" 
                type="url" 
                placeholder="https://www.instagram.com/..." 
                value={personInstagram} 
                onChange={(e) => setPersonInstagram(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-instagram-url">URL para Monitorar</Label>
              <Input 
                id="edit-instagram-url" 
                type="url" 
                placeholder="https://www.instagram.com/..." 
                value={instagramUrl} 
                onChange={(e) => setInstagramUrl(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-whatsapp-group">Grupo do WhatsApp</Label>
              <SimpleSelect value={whatsappRecipient} onValueChange={setWhatsappRecipient} disabled={isLoadingReplicadorGroups || replicadorGroups.length === 0}>
                <SimpleSelectTrigger id="edit-whatsapp-group" className="w-full">
                  <SimpleSelectValue placeholder={isLoadingReplicadorGroups ? 'Carregando grupos...' : replicadorGroups.length === 0 ? 'Nenhum grupo disponível' : 'Selecione um grupo'} />
                </SimpleSelectTrigger>
                <SimpleSelectContent items={replicadorGroups.map(group => ({ id: group.id, value: group.id, label: group.name }))} emptyMessage="Nenhum grupo encontrado. Verifique sua instância WAHA."></SimpleSelectContent>
              </SimpleSelect>
              {replicadorGroupsError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive font-medium">{replicadorGroupsError}</p>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={updateAgentMutation.isPending}>
                {updateAgentMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Instância Clone */}
      <Dialog open={isEditCloneInstanceOpen} onOpenChange={(open) => {
        setIsEditCloneInstanceOpen(open);
        if (!open) {
          setEditingCloneInstanceForDialog(null);
          setEditingInstance({ instanceName: "", wahaSession: "" });
        }
      }}>
        <DialogContent className="max-w-xl" aria-label="Modal Editar Instância Clone">
          <DialogHeader>
            <DialogTitle>Editar Agente</DialogTitle>
            <DialogDescription>Atualize as configurações do agente</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingCloneInstanceForDialog) return;

            if (!editingInstance.instanceName.trim() || !editingInstance.wahaSession.trim()) {
              return;
            }

            updateInstanceMutation.mutate({
              id: editingCloneInstanceForDialog.id,
              instanceName: editingInstance.instanceName.trim(),
              wahaSession: editingInstance.wahaSession.trim(),
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-clone-instance-name">Nome do Agente</Label>
              <Input
                id="edit-clone-instance-name"
                value={editingInstance.instanceName}
                onChange={(e) => setEditingInstance({...editingInstance, instanceName: e.target.value})}
                placeholder="Nome do agente"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Instância WAHA</Label>
              <SimpleSelect value={editingInstance.wahaSession} onValueChange={(value) => setEditingInstance({...editingInstance, wahaSession: value})}>
                <SimpleSelectTrigger>
                  <SimpleSelectValue placeholder="Selecione uma instância" />
                </SimpleSelectTrigger>
                <SimpleSelectContent 
                  items={wahaInstances.map(inst => ({ id: inst.name, value: inst.name, label: `${inst.name} (${inst.status})` }))} 
                  emptyMessage="Nenhuma instância encontrada. Crie uma na página Instâncias."
                />
              </SimpleSelect>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={updateInstanceMutation.isPending || !editingInstance.wahaSession}>
                {updateInstanceMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
