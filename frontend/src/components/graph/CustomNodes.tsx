import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { VisualGraphNode } from '../../types';
import {
  Box,
  Folder,
  FileCode,
  Component,
  ShieldCheck,
  Database,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Globe,
  Radio,
  Tv
} from 'lucide-react';

export const CustomGraphNode = memo(({ data, selected }: NodeProps<any>) => {
  const node = data as VisualGraphNode;
  const highlight = node.highlight_state;
  const isExternal = node.is_external === true;

  // Determine highlight classes
  let borderClass = isExternal
    ? 'border-dashed border-slate-500/60 bg-[#161b22]/75 hover:border-slate-400'
    : 'border-[#30363d] bg-[#161b22]/95';
  let opacityClass = isExternal ? 'opacity-85' : 'opacity-100';
  let glowClass = '';

  if (highlight === 'Selected' || selected) {
    borderClass = 'border-[#38bdf8] bg-[#161b22] ring-2 ring-[#38bdf8]/50';
    glowClass = 'glow-selected';
    opacityClass = 'opacity-100';
  } else if (highlight === 'InboundActive') {
    borderClass = 'border-[#38bdf8] bg-[#0c2438]/90 ring-1 ring-[#38bdf8]/40';
    glowClass = 'glow-cyan';
    opacityClass = 'opacity-100';
  } else if (highlight === 'OutboundActive') {
    borderClass = 'border-[#fb923c] bg-[#331c0e]/90 ring-1 ring-[#fb923c]/40';
    glowClass = 'glow-amber';
    opacityClass = 'opacity-100';
  } else if (highlight === 'MutualActive') {
    borderClass = 'border-[#ef4444] bg-[#381111]/90 ring-1 ring-[#ef4444]/60';
    glowClass = 'glow-red';
    opacityClass = 'opacity-100';
  } else if (highlight === 'Dimmed') {
    opacityClass = 'opacity-25 grayscale-[60%]';
  }

  // Category Icon & Badge
  let Icon = FileCode;
  let categoryBadge = 'Class';
  let badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';

  if (node.category === 'module') {
    Icon = Box;
    categoryBadge = 'Module';
    badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  } else if (node.category === 'package') {
    Icon = Folder;
    categoryBadge = 'Package';
    badgeColor = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  } else if (node.sub_label?.includes('RemoteServiceRelativePath') || node.sub_label?.includes('GWT:RemoteService')) {
    Icon = Radio;
    categoryBadge = 'GWT RPC';
    badgeColor = 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40';
  } else if (node.sub_label?.includes('GWT:RemoteServiceServlet')) {
    Icon = Radio;
    categoryBadge = 'GWT Servlet';
    badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  } else if (node.sub_label?.includes('GWT:EntryPoint')) {
    Icon = Tv;
    categoryBadge = 'GWT Entry';
    badgeColor = 'bg-pink-500/20 text-pink-300 border-pink-500/40';
  } else if (node.label.endsWith('Async')) {
    Icon = Radio;
    categoryBadge = 'GWT Async';
    badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  } else if (node.category === 'interface') {
    Icon = Layers;
    categoryBadge = 'Interface';
    badgeColor = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  } else if (node.sub_label?.includes('@Service')) {
    Icon = Component;
    categoryBadge = 'Service';
    badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (node.sub_label?.includes('@RestController') || node.sub_label?.includes('@Controller')) {
    Icon = ShieldCheck;
    categoryBadge = 'Controller';
    badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
  } else if (node.sub_label?.includes('@Repository')) {
    Icon = Database;
    categoryBadge = 'Repository';
    badgeColor = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
  }

  return (
    <div
      className={`min-w-[220px] max-w-[320px] rounded-xl border p-3.5 shadow-2xl backdrop-blur-md transition-all duration-200 cursor-pointer ${borderClass} ${opacityClass} ${glowClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#38bdf8] !w-2.5 !h-2.5 !border-2 !border-[#0d1117]"
      />

      {/* External boundary indicator pill */}
      {isExternal && (
        <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded mb-2 border border-dashed border-slate-600/60 w-fit">
          <Globe className="w-2.5 h-2.5 text-slate-400" />
          <span>Зовнішній зв'язок (External)</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 rounded-lg bg-white/5 text-slate-300">
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm text-slate-100 truncate tracking-tight">
            {node.label}
          </span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeColor}`}>
          {categoryBadge}
        </span>
      </div>

      {node.sub_label && (
        <div className="text-xs text-slate-400 font-mono truncate mb-2.5 bg-black/20 px-2 py-1 rounded">
          {node.sub_label}
        </div>
      )}

      {node.group && (
        <div className="text-[11px] text-slate-400 truncate mb-2">
          📁 {node.group}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2 mt-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sky-400 font-mono" title="Inbound (Incoming) dependencies">
            <ArrowDownLeft className="w-3 h-3" /> {node.degree_in}
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-mono" title="Outbound (Outgoing) dependencies">
            <ArrowUpRight className="w-3 h-3" /> {node.degree_out}
          </span>
        </div>
        {node.metrics_summary && (
          <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
            {node.metrics_summary}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#fb923c] !w-2.5 !h-2.5 !border-2 !border-[#0d1117]"
      />
    </div>
  );
});
