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

  // Determine Layer Header & Accent Colors
  let layerColor = 'bg-slate-700 text-slate-200 border-slate-600';
  let layerName = 'COMPONENT';
  let Icon = FileCode;

  if (node.category === 'module') {
    Icon = Box;
    layerName = 'MODULE';
    layerColor = 'bg-emerald-700 text-emerald-100 border-emerald-500';
  } else if (node.category === 'package') {
    Icon = Folder;
    layerName = 'PACKAGE';
    layerColor = 'bg-purple-700 text-purple-100 border-purple-500';
  } else if (node.sub_label?.includes('RemoteServiceRelativePath') || node.sub_label?.includes('GWT:RemoteService')) {
    Icon = Radio;
    layerName = 'GWT RPC';
    layerColor = 'bg-fuchsia-700 text-fuchsia-100 border-fuchsia-500';
  } else if (node.sub_label?.includes('GWT:RemoteServiceServlet')) {
    Icon = Radio;
    layerName = 'GWT SERVLET';
    layerColor = 'bg-indigo-700 text-indigo-100 border-indigo-500';
  } else if (node.sub_label?.includes('GWT:EntryPoint')) {
    Icon = Tv;
    layerName = 'GWT ENTRY';
    layerColor = 'bg-pink-700 text-pink-100 border-pink-500';
  } else if (node.label.endsWith('Async')) {
    Icon = Radio;
    layerName = 'GWT ASYNC';
    layerColor = 'bg-purple-700 text-purple-100 border-purple-500';
  } else if (node.category === 'interface') {
    Icon = Layers;
    layerName = 'INTERFACE';
    layerColor = 'bg-cyan-700 text-cyan-100 border-cyan-500';
  } else if (node.layer === 'UI' || node.sub_label?.includes('@RestController') || node.sub_label?.includes('@Controller')) {
    Icon = ShieldCheck;
    layerName = 'CONTROLLER / UI';
    layerColor = 'bg-emerald-700 text-emerald-100 border-emerald-500';
  } else if (node.layer === 'Service' || node.sub_label?.includes('@Service')) {
    Icon = Component;
    layerName = 'SERVICE';
    layerColor = 'bg-sky-700 text-sky-100 border-sky-500';
  } else if (node.layer === 'Infrastructure' || node.sub_label?.includes('@Repository')) {
    Icon = Database;
    layerName = 'REPOSITORY / DAO';
    layerColor = 'bg-indigo-700 text-indigo-100 border-indigo-500';
  } else if (node.layer === 'Domain' || node.sub_label?.includes('@Entity')) {
    Icon = FileCode;
    layerName = 'DOMAIN MODEL';
    layerColor = 'bg-amber-700 text-amber-100 border-amber-500';
  }

  // Highlight state styling (clean solid borders, no fuzzy neon blur)
  let cardBorder = isExternal
    ? 'border-dashed border-slate-500 bg-[#161b22]'
    : 'border-[#30363d] bg-[#161b22]';
  let cardOpacity = isExternal ? 'opacity-90' : 'opacity-100';

  if (highlight === 'Selected' || selected) {
    cardBorder = 'border-2 border-sky-400 ring-2 ring-sky-400/30 bg-[#1c2333] shadow-xl';
    cardOpacity = 'opacity-100';
  } else if (highlight === 'InboundActive') {
    cardBorder = 'border-2 border-sky-400 bg-[#0f2438] shadow-lg';
    cardOpacity = 'opacity-100';
  } else if (highlight === 'OutboundActive') {
    cardBorder = 'border-2 border-amber-400 bg-[#331d0c] shadow-lg';
    cardOpacity = 'opacity-100';
  } else if (highlight === 'MutualActive') {
    cardBorder = 'border-2 border-rose-500 bg-[#381111] shadow-lg';
    cardOpacity = 'opacity-100';
  } else if (highlight === 'Dimmed') {
    cardOpacity = 'opacity-20 grayscale';
  }

  return (
    <div
      className={`w-[270px] rounded-lg border shadow-md transition-all duration-150 cursor-pointer overflow-hidden ${cardBorder} ${cardOpacity}`}
    >
      {/* Top Handle (Inbound Target) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-sky-400 !w-3 !h-3 !border-2 !border-[#0d1117] !-top-1.5"
      />

      {/* Left Handle (Inbound Target) */}
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className="!bg-sky-400 !w-3 !h-3 !border-2 !border-[#0d1117] !-left-1.5"
      />

      {/* Header Bar with Layer Badge */}
      <div className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-between border-b ${layerColor}`}>
        <span className="flex items-center gap-1.5 truncate">
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{layerName}</span>
        </span>
        {node.hop_depth !== undefined && node.hop_depth > 0 && (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-white font-bold ml-1 flex-shrink-0">
            Hop {node.hop_depth}
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="p-2.5 space-y-1.5">
        {/* Class Name */}
        <div className="font-bold text-sm text-slate-100 truncate tracking-tight" title={node.label}>
          {node.label}
        </div>

        {/* Package Path / Sub Label */}
        {node.group && (
          <div className="text-[11px] font-mono text-slate-400 truncate flex items-center gap-1" title={node.group}>
            <span className="text-slate-400">📁</span>
            <span className="truncate">{node.group.split('.').slice(-2).join('.')}</span>
          </div>
        )}

        {node.sub_label && !node.sub_label.includes('LOC') && (
          <div className="text-[10px] font-mono text-amber-300 truncate bg-black/30 px-1.5 py-0.5 rounded border border-white/5" title={node.sub_label}>
            {node.sub_label}
          </div>
        )}

        {/* Metrics & Inbound / Outbound Count Footer */}
        <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-white/10 mt-1">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold ${
                node.degree_in > 0 ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400'
              }`}
              title={`${node.degree_in} вхідних викликів (хто викликає цей клас)`}
            >
              <ArrowDownLeft className="w-2.5 h-2.5" /> {node.degree_in} in
            </span>
            <span
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold ${
                node.degree_out > 0 ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'
              }`}
              title={`${node.degree_out} вихідних викликів (кого викликає цей клас)`}
            >
              <ArrowUpRight className="w-2.5 h-2.5" /> {node.degree_out} out
            </span>
          </div>

          {node.metrics_summary && (
            <span className="text-slate-400 text-[9px] truncate max-w-[90px]">
              {node.metrics_summary.split(',')[0]}
            </span>
          )}
        </div>
      </div>

      {/* Right Handle (Outbound Source) */}
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className="!bg-amber-400 !w-3 !h-3 !border-2 !border-[#0d1117] !-right-1.5"
      />

      {/* Bottom Handle (Outbound Source) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400 !w-3 !h-3 !border-2 !border-[#0d1117] !-bottom-1.5"
      />
    </div>
  );
});
