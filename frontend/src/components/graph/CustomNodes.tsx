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

  // Header Colors (High Contrast, Bold Solid Colors with Pure White Text)
  let headerBg = 'bg-slate-700';
  let layerName = 'COMPONENT';
  let Icon = FileCode;

  if (node.category === 'module') {
    Icon = Box;
    layerName = 'MODULE';
    headerBg = 'bg-emerald-700';
  } else if (node.category === 'package') {
    Icon = Folder;
    layerName = 'PACKAGE';
    headerBg = 'bg-purple-700';
  } else if (node.sub_label?.includes('RemoteServiceRelativePath') || node.sub_label?.includes('GWT:RemoteService')) {
    Icon = Radio;
    layerName = 'GWT RPC';
    headerBg = 'bg-fuchsia-700';
  } else if (node.sub_label?.includes('GWT:RemoteServiceServlet')) {
    Icon = Radio;
    layerName = 'GWT SERVLET';
    headerBg = 'bg-indigo-700';
  } else if (node.sub_label?.includes('GWT:EntryPoint')) {
    Icon = Tv;
    layerName = 'GWT ENTRY';
    headerBg = 'bg-pink-700';
  } else if (node.label.endsWith('Async')) {
    Icon = Radio;
    layerName = 'GWT ASYNC';
    headerBg = 'bg-purple-700';
  } else if (node.category === 'interface') {
    Icon = Layers;
    layerName = 'INTERFACE';
    headerBg = 'bg-cyan-700';
  } else if (node.layer === 'UI' || node.sub_label?.includes('@RestController') || node.sub_label?.includes('@Controller')) {
    Icon = ShieldCheck;
    layerName = 'CONTROLLER / UI';
    headerBg = 'bg-teal-700';
  } else if (node.layer === 'Service' || node.sub_label?.includes('@Service')) {
    Icon = Component;
    layerName = 'SERVICE';
    headerBg = 'bg-blue-700';
  } else if (node.layer === 'Infrastructure' || node.sub_label?.includes('@Repository')) {
    Icon = Database;
    layerName = 'REPOSITORY / DAO';
    headerBg = 'bg-indigo-700';
  } else if (node.layer === 'Domain' || node.sub_label?.includes('@Entity')) {
    Icon = FileCode;
    layerName = 'DOMAIN MODEL';
    headerBg = 'bg-amber-700';
  }

  // Card Background and Border - High Contrast Solid Colors
  let cardClass = 'border-2 border-[#475569] bg-[#1e293b] text-[#f8fafc]';

  if (highlight === 'Selected' || selected) {
    cardClass = 'border-2 border-[#38bdf8] bg-[#0f172a] ring-2 ring-[#38bdf8]/50 shadow-2xl text-[#ffffff]';
  } else if (highlight === 'InboundActive') {
    cardClass = 'border-2 border-[#38bdf8] bg-[#0c2d48] shadow-lg text-[#ffffff]';
  } else if (highlight === 'OutboundActive') {
    cardClass = 'border-2 border-[#fb923c] bg-[#3d1a04] shadow-lg text-[#ffffff]';
  } else if (highlight === 'MutualActive') {
    cardClass = 'border-2 border-[#ef4444] bg-[#3b0811] shadow-lg text-[#ffffff]';
  } else if (highlight === 'Dimmed') {
    cardClass = 'border border-slate-700 bg-[#161f2e] opacity-60 text-[#e2e8f0]';
  }

  if (isExternal) {
    cardClass += ' border-dashed';
  }

  return (
    <div
      className={`w-[280px] rounded-lg shadow-md transition-all duration-100 cursor-pointer overflow-hidden ${cardClass}`}
    >
      {/* Top Handle (Inbound Target) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#38bdf8] !w-3 !h-3 !border-2 !border-[#0d1117] !-top-1.5"
      />

      {/* Left Handle (Inbound Target) */}
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className="!bg-[#38bdf8] !w-3 !h-3 !border-2 !border-[#0d1117] !-left-1.5"
      />

      {/* Header Bar with Layer Badge (Guaranteed White Text) */}
      <div className={`px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between text-white ${headerBg}`}>
        <span className="flex items-center gap-1.5 truncate text-white">
          <Icon className="w-3.5 h-3.5 flex-shrink-0 text-white" />
          <span className="truncate text-white">{layerName}</span>
        </span>
        {node.hop_depth !== undefined && node.hop_depth > 0 && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/60 text-white font-bold ml-1 flex-shrink-0">
            Hop {node.hop_depth}
          </span>
        )}
      </div>

      {/* Main Content Area with Crisp Bright White / Silver Text */}
      <div className="p-3 space-y-2 bg-inherit">
        {/* Class or Module Name (Always bright white and bold) */}
        <div
          className="font-bold text-[14px] text-white truncate tracking-wide"
          style={{ color: '#ffffff' }}
          title={node.label}
        >
          {node.label}
        </div>

        {/* Sublabel: Package count, Classes count, or annotations */}
        {node.sub_label && (
          <div
            className="text-[11px] font-mono truncate bg-black/50 px-2 py-0.5 rounded border border-white/10"
            style={{ color: '#bae6fd' }}
            title={node.sub_label}
          >
            {node.sub_label}
          </div>
        )}

        {/* Package info if present */}
        {node.group && (
          <div
            className="text-[11px] font-mono truncate flex items-center gap-1"
            style={{ color: '#cbd5e1' }}
            title={node.group}
          >
            <span>📁</span>
            <span className="truncate">{node.group.split('.').slice(-2).join('.')}</span>
          </div>
        )}

        {/* Inbound and Outbound Dependency Counters Footer */}
        <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-700 mt-1">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                node.degree_in > 0 ? 'bg-sky-500/30 text-[#38bdf8]' : 'text-slate-400'
              }`}
              style={{ color: node.degree_in > 0 ? '#38bdf8' : '#94a3b8' }}
              title={`${node.degree_in} вхідних (хто викликає цей елемент)`}
            >
              <ArrowDownLeft className="w-3 h-3 text-[#38bdf8]" /> {node.degree_in} in
            </span>
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                node.degree_out > 0 ? 'bg-amber-500/30 text-[#fb923c]' : 'text-slate-400'
              }`}
              style={{ color: node.degree_out > 0 ? '#fb923c' : '#94a3b8' }}
              title={`${node.degree_out} вихідних (кого викликає цей елемент)`}
            >
              <ArrowUpRight className="w-3 h-3 text-[#fb923c]" /> {node.degree_out} out
            </span>
          </div>

          {node.metrics_summary && (
            <span
              className="text-[10px] font-mono truncate max-w-[100px]"
              style={{ color: '#94a3b8' }}
              title={node.metrics_summary}
            >
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
        className="!bg-[#fb923c] !w-3 !h-3 !border-2 !border-[#0d1117] !-right-1.5"
      />

      {/* Bottom Handle (Outbound Source) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#fb923c] !w-3 !h-3 !border-2 !border-[#0d1117] !-bottom-1.5"
      />
    </div>
  );
});
