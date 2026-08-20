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
  Radio,
  Tv
} from 'lucide-react';

export const CustomGraphNode = memo(({ data, selected }: NodeProps<any>) => {
  const node = data as VisualGraphNode;
  const highlight = node.highlight_state;
  const isExternal = node.is_external === true;

  // Determine Layer Header & Colors (High Contrast, No Blurry Glow)
  let layerColor = 'bg-slate-700 text-white';
  let layerName = 'COMPONENT';
  let Icon = FileCode;

  if (node.category === 'module') {
    Icon = Box;
    layerName = 'MODULE';
    layerColor = 'bg-emerald-700 text-white';
  } else if (node.category === 'package') {
    Icon = Folder;
    layerName = 'PACKAGE';
    layerColor = 'bg-purple-700 text-white';
  } else if (node.sub_label?.includes('RemoteServiceRelativePath') || node.sub_label?.includes('GWT:RemoteService')) {
    Icon = Radio;
    layerName = 'GWT RPC';
    layerColor = 'bg-fuchsia-700 text-white';
  } else if (node.sub_label?.includes('GWT:RemoteServiceServlet')) {
    Icon = Radio;
    layerName = 'GWT SERVLET';
    layerColor = 'bg-indigo-700 text-white';
  } else if (node.sub_label?.includes('GWT:EntryPoint')) {
    Icon = Tv;
    layerName = 'GWT ENTRY';
    layerColor = 'bg-pink-700 text-white';
  } else if (node.label.endsWith('Async')) {
    Icon = Radio;
    layerName = 'GWT ASYNC';
    layerColor = 'bg-purple-700 text-white';
  } else if (node.category === 'interface') {
    Icon = Layers;
    layerName = 'INTERFACE';
    layerColor = 'bg-cyan-700 text-white';
  } else if (node.layer === 'UI' || node.sub_label?.includes('@RestController') || node.sub_label?.includes('@Controller')) {
    Icon = ShieldCheck;
    layerName = 'CONTROLLER / UI';
    layerColor = 'bg-teal-700 text-white';
  } else if (node.layer === 'Service' || node.sub_label?.includes('@Service')) {
    Icon = Component;
    layerName = 'SERVICE';
    layerColor = 'bg-blue-700 text-white';
  } else if (node.layer === 'Infrastructure' || node.sub_label?.includes('@Repository')) {
    Icon = Database;
    layerName = 'REPOSITORY / DAO';
    layerColor = 'bg-indigo-700 text-white';
  } else if (node.layer === 'Domain' || node.sub_label?.includes('@Entity')) {
    Icon = FileCode;
    layerName = 'DOMAIN MODEL';
    layerColor = 'bg-amber-700 text-white';
  }

  // Card Background and Border - High Contrast Solid Colors
  let cardBorder = isExternal
    ? 'border-2 border-dashed border-slate-500 bg-[#1e293b]'
    : 'border-2 border-[#334155] bg-[#161f2e]';
  let cardOpacity = 'opacity-100';

  if (highlight === 'Selected' || selected) {
    cardBorder = 'border-2 border-sky-400 bg-[#0f172a] ring-2 ring-sky-400/40 shadow-xl';
    cardOpacity = 'opacity-100';
  } else if (highlight === 'InboundActive') {
    cardBorder = 'border-2 border-sky-400 bg-[#082f49] shadow-lg';
    cardOpacity = 'opacity-100';
  } else if (highlight === 'OutboundActive') {
    cardBorder = 'border-2 border-amber-400 bg-[#451a03] shadow-lg';
    cardOpacity = 'opacity-100';
  } else if (highlight === 'MutualActive') {
    cardBorder = 'border-2 border-rose-500 bg-[#4c0519] shadow-lg';
    cardOpacity = 'opacity-100';
  } else if (highlight === 'Dimmed') {
    // Keep text 100% readable even when dimmed
    cardOpacity = 'opacity-40';
    cardBorder = 'border border-slate-700 bg-[#0f172a]';
  }

  return (
    <div
      className={`w-[280px] rounded-lg shadow-md transition-all duration-100 cursor-pointer overflow-hidden ${cardBorder} ${cardOpacity}`}
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
      <div className={`px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between ${layerColor}`}>
        <span className="flex items-center gap-1.5 truncate">
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{layerName}</span>
        </span>
        {node.hop_depth !== undefined && node.hop_depth > 0 && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/50 text-white font-bold ml-1 flex-shrink-0">
            Hop {node.hop_depth}
          </span>
        )}
      </div>

      {/* Main Content Area with Crisp Legible Text */}
      <div className="p-3 space-y-1.5">
        {/* Class or Module Name (Always bright white and bold) */}
        <div className="font-bold text-[14px] text-white truncate tracking-wide" title={node.label}>
          {node.label}
        </div>

        {/* Sublabel: Package count, Classes count, or annotations */}
        {node.sub_label && (
          <div className="text-[11px] font-mono text-slate-200 truncate bg-black/40 px-2 py-0.5 rounded" title={node.sub_label}>
            {node.sub_label}
          </div>
        )}

        {/* Package info if present */}
        {node.group && (
          <div className="text-[11px] font-mono text-slate-300 truncate flex items-center gap-1" title={node.group}>
            <span className="text-slate-400">📁</span>
            <span className="truncate">{node.group.split('.').slice(-2).join('.')}</span>
          </div>
        )}

        {/* Inbound and Outbound Dependency Counters Footer */}
        <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-700/80 mt-1">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                node.degree_in > 0 ? 'bg-sky-500/30 text-sky-200' : 'text-slate-400'
              }`}
              title={`${node.degree_in} вхідних (хто викликає цей елемент)`}
            >
              <ArrowDownLeft className="w-3 h-3 text-sky-300" /> {node.degree_in} in
            </span>
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                node.degree_out > 0 ? 'bg-amber-500/30 text-amber-200' : 'text-slate-400'
              }`}
              title={`${node.degree_out} вихідних (кого викликає цей елемент)`}
            >
              <ArrowUpRight className="w-3 h-3 text-amber-300" /> {node.degree_out} out
            </span>
          </div>

          {node.metrics_summary && (
            <span className="text-slate-300 text-[10px] truncate max-w-[100px]" title={node.metrics_summary}>
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
