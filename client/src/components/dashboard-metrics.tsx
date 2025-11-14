import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, CheckCircle, Package, MapPin, TrendingUp, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleSelect, SimpleSelectContent, SimpleSelectTrigger, SimpleSelectValue } from "@/components/ui/simple-select";
import { Button } from "@/components/ui/button";
import type { Voter, CampaignMaterial, Leadership, ConfigOption } from "@shared/schema";
import EleitoresIcon from "@/assets/icons/Eleitores.svg";
import MaterialIcon from "@/assets/icons/Material.svg";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ResponsiveContainer } from 'recharts';

export default function DashboardMetrics() {
  // Filter states
  const [municipioFilter, setMunicipioFilter] = useState("all");
  const [bairroFilter, setBairroFilter] = useState("all");
  const [leadershipFilter, setLeadershipFilter] = useState("all");
  

  const { data: voters = [] } = useQuery<Voter[]>({
    queryKey: ['/api/voters'],
  });

  const { data: materials = [] } = useQuery<CampaignMaterial[]>({
    queryKey: ['/api/materials'],
  });

  const { data: leaderships = [] } = useQuery<Leadership[]>({
    queryKey: ['/api/leaderships'],
  });

  const { data: assessores = [] } = useQuery<Leadership[]>({
    queryKey: ['/api/assessores'],
  });

  // Combine leaderships and assessores
  const teamMembers = [...leaderships, ...assessores];
  
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

  // Apply filters
  const filteredVoters = voters.filter(voter => {
    const matchesMunicipio = municipioFilter === "all" || voter.municipio === municipioFilter;
    const matchesBairro = bairroFilter === "all" || voter.bairro === bairroFilter;
    const matchesLeadership = leadershipFilter === "all" || voter.indicacao === leadershipFilter;
    
    return matchesMunicipio && matchesBairro && matchesLeadership;
  });

  // Filtrar equipe (lideranças e assessores) baseado no município e bairro selecionados
  const filteredTeamMembers = teamMembers.filter(member => {
    const matchesMunicipio = municipioFilter === "all" || member.municipio === municipioFilter;
    const matchesBairro = bairroFilter === "all" || member.bairro === bairroFilter;
    return matchesMunicipio && matchesBairro;
  });

  // Obter indicações únicas dos eleitores filtrados e membros da equipe filtrados
  const uniqueIndicacoes = Array.from(new Set(
    voters
      .filter(v => {
        const matchesMunicipio = municipioFilter === "all" || v.municipio === municipioFilter;
        const matchesBairro = bairroFilter === "all" || v.bairro === bairroFilter;
        return matchesMunicipio && matchesBairro;
      })
      .map(v => v.indicacao)
      .filter(i => i && i.trim() !== '')
  ));
  
  const teamMemberNames = filteredTeamMembers.map(l => l.nome).filter(n => n && n.trim() !== '');
  const uniqueLeaderships = Array.from(new Set([...uniqueIndicacoes, ...teamMemberNames]));

  const totalVoters = filteredVoters.length;
  const confirmedVotes = filteredVoters.filter(v => v.voto === 'confirmado').length;
  const deliveredMaterials = materials.filter(m => m.status === 'distribuido').reduce((sum, m) => sum + m.quantidade, 0);
  const activeMunicipios = new Set(filteredVoters.map(v => v.municipio)).size;

  // Dados para gráfico de evolução temporal (simulado)
  const voteEvolutionData = [
    { periodo: 'Jan', votos: Math.round(confirmedVotes * 0.1) },
    { periodo: 'Fev', votos: Math.round(confirmedVotes * 0.2) },
    { periodo: 'Mar', votos: Math.round(confirmedVotes * 0.35) },
    { periodo: 'Abr', votos: Math.round(confirmedVotes * 0.5) },
    { periodo: 'Mai', votos: Math.round(confirmedVotes * 0.7) },
    { periodo: 'Jun', votos: Math.round(confirmedVotes * 0.85) },
    { periodo: 'Jul', votos: confirmedVotes }
  ];

  // Dados para gráfico de distribuição por município
  const municipioDistribution = filteredVoters.reduce((acc, voter) => {
    if (!acc[voter.municipio]) {
      acc[voter.municipio] = { municipio: voter.municipio, confirmados: 0, total: 0 };
    }
    acc[voter.municipio].total++;
    if (voter.voto === 'confirmado') {
      acc[voter.municipio].confirmados++;
    }
    return acc;
  }, {} as Record<string, { municipio: string; confirmados: number; total: number }>);

  const municipioData = Object.values(municipioDistribution).sort((a, b) => b.confirmados - a.confirmados);

  // Dados para métrica de indicação
  const indicacaoDistribution = filteredVoters.reduce((acc, voter) => {
    if (!acc[voter.indicacao]) {
      acc[voter.indicacao] = { total: 0, confirmados: 0 };
    }
    acc[voter.indicacao].total++;
    if (voter.voto === 'confirmado') {
      acc[voter.indicacao].confirmados++;
    }
    return acc;
  }, {} as Record<string, { total: number; confirmados: number }>);

  const indicacaoData = Object.entries(indicacaoDistribution)
    .map(([indicacao, data]) => ({ 
      indicacao, 
      eleitores: data.total,
      confirmados: data.confirmados 
    }))
    .sort((a, b) => b.eleitores - a.eleitores);

  const metrics = [
    {
      title: "Total de Eleitores",
      value: totalVoters,
      icon: "custom-eleitores",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      change: "",
      changeText: ""
    },
    {
      title: "Votos Confirmados",
      value: confirmedVotes,
      icon: CheckCircle,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      change: "",
      changeText: ""
    },
    {
      title: "Material Entregue",
      value: deliveredMaterials,
      icon: "custom-material",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      change: "",
      changeText: ""
    },
    {
      title: "Municípios Ativos",
      value: activeMunicipios,
      icon: MapPin,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      change: "",
      changeText: ""
    }
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Dashboard de Métricas</h2>
          <p className="text-muted-foreground mt-2">Visão geral das métricas da campanha</p>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">Município</label>
                <SimpleSelect 
                  value={municipioFilter} 
                  onValueChange={(value) => {
                    setMunicipioFilter(value);
                    // Reset bairro and leadership filters when município changes
                    setBairroFilter('all');
                    setLeadershipFilter('all');
                  }}
                >
                  <SimpleSelectTrigger data-testid="select-municipio-filter">
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
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">Bairro</label>
                <SimpleSelect 
                  value={bairroFilter} 
                  onValueChange={(value) => {
                    setBairroFilter(value);
                    // Reset leadership filter when bairro changes
                    setLeadershipFilter('all');
                  }}
                >
                  <SimpleSelectTrigger data-testid="select-bairro-filter">
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
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">Liderança</label>
                <SimpleSelect value={leadershipFilter} onValueChange={setLeadershipFilter}>
                  <SimpleSelectTrigger data-testid="select-leadership-filter">
                    <SimpleSelectValue placeholder="Todas as lideranças" />
                  </SimpleSelectTrigger>
                  <SimpleSelectContent 
                    items={[
                      { id: "all", value: "all", label: "Todas as lideranças" },
                      ...uniqueLeaderships.map((leadership, index) => ({
                        id: `leadership-${index}`,
                        value: leadership,
                        label: leadership
                      }))
                    ]}
                    emptyMessage="Nenhuma liderança encontrada"
                  />
                </SimpleSelect>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, index) => {
            return (
              <Card key={index} className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.title}</p>
                      <p className="text-2xl font-bold text-card-foreground" data-testid={`metric-${index}-value`}>
                        {metric.value.toLocaleString()}
                      </p>
                    </div>
                    <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                      {metric.icon === "custom-eleitores" ? (
                        <img 
                          src={EleitoresIcon} 
                          alt="Eleitores" 
                          className="w-6 h-6" 
                          style={{filter: 'brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(1917%) hue-rotate(204deg) brightness(95%) contrast(101%)'}} 
                        />
                      ) : metric.icon === "custom-material" ? (
                        <img 
                          src={MaterialIcon} 
                          alt="Material" 
                          className="w-6 h-6" 
                          style={{filter: 'brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(1917%) hue-rotate(204deg) brightness(95%) contrast(101%)'}} 
                        />
                      ) : (
                        (() => {
                          const Icon = metric.icon as any;
                          return <Icon className={`w-6 h-6 ${metric.color}`} />;
                        })()
                      )}
                    </div>
                  </div>
                  {(metric.change && metric.changeText) && (
                    <div className="flex items-center mt-4 text-sm">
                      <span className="text-blue-500 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        {metric.change}
                      </span>
                      <span className="text-muted-foreground ml-2">{metric.changeText}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Evolução de Votos Confirmados</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={voteEvolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="periodo" 
                      tick={{ fill: 'var(--card-foreground)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={{ stroke: 'var(--border)' }}
                    />
                    <YAxis 
                      tick={{ fill: 'var(--card-foreground)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={{ stroke: 'var(--border)' }}
                    />
                    <Tooltip 
                      wrapperStyle={{ zIndex: 9999 }}
                      content={(props) => {
                        if (!props.active || !props.payload) return null;
                        const { payload, label } = props;
                        return (
                          <div 
                            className="custom-tooltip-dark"
                            style={{
                              backgroundColor: '#121212',
                              background: '#121212',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#ffffff',
                              zIndex: 9999,
                              position: 'relative',
                              boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
                            }}>
                            <p style={{ margin: 0, fontWeight: 'bold', color: '#ffffff', backgroundColor: 'transparent' }}>{label}</p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ margin: 0, color: '#ffffff', backgroundColor: 'transparent' }}>
                                Votos: {entry.value}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="votos" 
                      stroke="var(--primary)" 
                      strokeWidth={2}
                      dot={{ fill: 'var(--primary)', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Distribuição por Município</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={municipioData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="municipio" 
                      tick={{ fill: 'var(--card-foreground)', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={{ stroke: 'var(--border)' }}
                    />
                    <YAxis 
                      tick={{ fill: 'var(--card-foreground)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={{ stroke: 'var(--border)' }}
                    />
                    <Tooltip 
                      wrapperStyle={{ zIndex: 9999 }}
                      content={(props) => {
                        if (!props.active || !props.payload) return null;
                        const { payload, label } = props;
                        return (
                          <div 
                            className="custom-tooltip-dark"
                            style={{
                              backgroundColor: '#121212',
                              background: '#121212',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#ffffff',
                              zIndex: 9999,
                              position: 'relative',
                              boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
                            }}>
                            <p style={{ margin: 0, fontWeight: 'bold', color: '#ffffff', backgroundColor: 'transparent' }}>{label}</p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ margin: 0, color: '#ffffff', backgroundColor: 'transparent' }}>
                                {entry.name === 'confirmados' ? 'Votos Confirmados' : 'Total de Eleitores'}: {entry.value}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="var(--primary)" 
                      fillOpacity={0.3}
                      name="total"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="confirmados" 
                      fill="var(--primary)" 
                      name="confirmados"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Indicação Distribution Section */}
        <div className="mt-6">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Eleitores por Indicação</h3>
              {indicacaoData.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma indicação registrada</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {indicacaoData.map((item, index) => (
                    <div key={index} className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="flex flex-col gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Indicação</p>
                          <p className="font-semibold text-lg text-card-foreground">{item.indicacao}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-primary">{item.eleitores}</p>
                            <p className="text-xs text-muted-foreground">total de eleitores</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-500">{item.confirmados}</p>
                            <p className="text-xs text-muted-foreground">confirmados</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Total de eleitores: <span className="font-semibold text-card-foreground">{totalVoters}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
