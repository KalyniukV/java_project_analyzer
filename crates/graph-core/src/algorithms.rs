use crate::models::*;
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::{HashMap, HashSet, VecDeque};

pub struct GraphAnalyzer {
    pub model: ProjectModel,
}

impl GraphAnalyzer {
    pub fn new(model: ProjectModel) -> Self {
        Self { model }
    }

    /// Calculate package metrics (Ca, Ce, Instability, Abstractness)
    pub fn calculate_metrics(&mut self) {
        let mut class_to_pkg: HashMap<String, String> = HashMap::new();
        let mut pkg_classes: HashMap<String, Vec<String>> = HashMap::new();

        for cls in &self.model.classes {
            class_to_pkg.insert(cls.id.clone(), cls.package_name.clone());
            pkg_classes
                .entry(cls.package_name.clone())
                .or_default()
                .push(cls.id.clone());
        }

        // Calculate package-to-package dependencies
        let mut pkg_efferent: HashMap<String, HashSet<String>> = HashMap::new();
        let mut pkg_afferent: HashMap<String, HashSet<String>> = HashMap::new();

        for rel in &self.model.relationships {
            if let (Some(src_pkg), Some(tgt_pkg)) =
                (class_to_pkg.get(&rel.source), class_to_pkg.get(&rel.target))
            {
                if src_pkg != tgt_pkg {
                    pkg_efferent
                        .entry(src_pkg.clone())
                        .or_default()
                        .insert(tgt_pkg.clone());
                    pkg_afferent
                        .entry(tgt_pkg.clone())
                        .or_default()
                        .insert(src_pkg.clone());
                }
            }
        }

        // Update packages in model
        for pkg in &mut self.model.packages {
            let ca = pkg_afferent
                .get(&pkg.id)
                .map(|s| s.len())
                .unwrap_or(0);
            let ce = pkg_efferent
                .get(&pkg.id)
                .map(|s| s.len())
                .unwrap_or(0);
            let total_c = ca + ce;
            let instability = if total_c > 0 {
                ce as f64 / total_c as f64
            } else {
                0.0
            };

            let classes_in_pkg = pkg_classes.get(&pkg.id).map(|v| v.len()).unwrap_or(0);
            let abstract_count = self
                .model
                .classes
                .iter()
                .filter(|c| {
                    c.package_name == pkg.id
                        && (c.kind == ClassKind::Interface || c.kind == ClassKind::AbstractClass)
                })
                .count();

            let abstractness = if classes_in_pkg > 0 {
                abstract_count as f64 / classes_in_pkg as f64
            } else {
                0.0
            };

            let dist = (abstractness + instability - 1.0).abs();

            pkg.metrics = Some(PackageMetrics {
                afferent_coupling: ca,
                efferent_coupling: ce,
                instability,
                abstractness,
                distance_main_seq: dist,
            });
        }
    }

    /// Detect cycles using Tarjan's Strongly Connected Components
    pub fn find_cycles(&self, level: &str) -> Vec<CycleInfo> {
        let mut graph = DiGraph::<String, ()>::new();
        let mut node_map: HashMap<String, NodeIndex> = HashMap::new();
        let mut inv_map: HashMap<NodeIndex, String> = HashMap::new();

        match level {
            "modules" => {
                for m in &self.model.modules {
                    let idx = graph.add_node(m.id.clone());
                    node_map.insert(m.id.clone(), idx);
                    inv_map.insert(idx, m.id.clone());
                }
                for rel in &self.model.relationships {
                    if rel.kind == RelationKind::ModuleDependency {
                        if let (Some(&src), Some(&tgt)) =
                            (node_map.get(&rel.source), node_map.get(&rel.target))
                        {
                            if src != tgt {
                                graph.add_edge(src, tgt, ());
                            }
                        }
                    }
                }
            }
            "packages" => {
                for p in &self.model.packages {
                    let idx = graph.add_node(p.id.clone());
                    node_map.insert(p.id.clone(), idx);
                    inv_map.insert(idx, p.id.clone());
                }
                for rel in &self.model.relationships {
                    if rel.kind == RelationKind::PackageDependency {
                        if let (Some(&src), Some(&tgt)) =
                            (node_map.get(&rel.source), node_map.get(&rel.target))
                        {
                            if src != tgt {
                                graph.add_edge(src, tgt, ());
                            }
                        }
                    }
                }
            }
            _ => {
                // classes
                for c in &self.model.classes {
                    let idx = graph.add_node(c.id.clone());
                    node_map.insert(c.id.clone(), idx);
                    inv_map.insert(idx, c.id.clone());
                }
                for rel in &self.model.relationships {
                    if rel.kind != RelationKind::ModuleDependency
                        && rel.kind != RelationKind::PackageDependency
                    {
                        if let (Some(&src), Some(&tgt)) =
                            (node_map.get(&rel.source), node_map.get(&rel.target))
                        {
                            if src != tgt {
                                graph.add_edge(src, tgt, ());
                            }
                        }
                    }
                }
            }
        }

        let sccs = petgraph::algo::tarjan_scc(&graph);
        let mut cycles = Vec::new();
        let mut cycle_counter = 1;

        for scc in sccs {
            if scc.len() > 1 {
                let path: Vec<String> = scc
                    .into_iter()
                    .filter_map(|idx| inv_map.get(&idx).cloned())
                    .collect();
                cycles.push(CycleInfo {
                    id: format!("cycle-{}-{}", level, cycle_counter),
                    cycle_type: format!("{}_cycle", level),
                    length: path.len(),
                    path,
                });
                cycle_counter += 1;
            }
        }

        cycles
    }

    /// Build Visual Graph Payload with interactive Focus, Scoping, and Boundary / External Dependencies
    pub fn build_visual_graph(
        &self,
        view_type: &str,
        selected_id: Option<&str>,
        depth: u32,
        isolate_mode: bool,
        module_filter: Option<&[String]>,
        package_filter: Option<&[String]>,
        include_external: bool,
    ) -> VisualGraphPayload {
        let mut visual_nodes: Vec<VisualGraphNode> = Vec::new();
        let mut visual_edges: Vec<VisualGraphEdge> = Vec::new();

        let mod_set: Option<HashSet<&str>> = module_filter.and_then(|m| {
            let s: HashSet<&str> = m.iter().map(|s| s.as_str()).filter(|s| !s.is_empty()).collect();
            if s.is_empty() { None } else { Some(s) }
        });

        let pkg_set: Option<HashSet<&str>> = package_filter.and_then(|p| {
            let s: HashSet<&str> = p.iter().map(|s| s.as_str()).filter(|s| !s.is_empty()).collect();
            if s.is_empty() { None } else { Some(s) }
        });

        let has_filter = mod_set.is_some() || pkg_set.is_some();

        // 1. Collect nodes and edges based on view_type & scoping filters
        match view_type {
            "modules" => {
                let mut core_ids: HashSet<String> = HashSet::new();
                for m in &self.model.modules {
                    let is_match = match &mod_set {
                        Some(ms) => ms.contains(m.id.as_str()),
                        None => true,
                    };
                    if is_match {
                        core_ids.insert(m.id.clone());
                    }
                }

                // If include_external, find neighbor modules that connect with core_ids
                let mut boundary_ids: HashSet<String> = HashSet::new();
                if include_external && has_filter {
                    for rel in &self.model.relationships {
                        if rel.kind == RelationKind::ModuleDependency {
                            let src_in = core_ids.contains(&rel.source);
                            let tgt_in = core_ids.contains(&rel.target);
                            if src_in && !tgt_in {
                                boundary_ids.insert(rel.target.clone());
                            } else if !src_in && tgt_in {
                                boundary_ids.insert(rel.source.clone());
                            }
                        }
                    }
                }

                for m in &self.model.modules {
                    let is_core = core_ids.contains(&m.id);
                    let is_ext = boundary_ids.contains(&m.id);

                    if is_core || is_ext {
                        visual_nodes.push(VisualGraphNode {
                            id: m.id.clone(),
                            label: m.name.clone(),
                            sub_label: Some(format!("{} pkgs", m.exported_packages.len())),
                            category: "module".to_string(),
                            layer: None,
                            group: None,
                            highlight_state: NodeHighlightState::Normal,
                            degree_in: m.afferent_coupling,
                            degree_out: m.efferent_coupling,
                            metrics_summary: Some(format!("Ce: {}, Ca: {}, I: {:.2}", m.efferent_coupling, m.afferent_coupling, m.instability)),
                            file_path: Some(m.path.clone()),
                            line_number: None,
                            is_external: Some(is_ext),
                        });
                    }
                }

                let visible_ids: HashSet<&str> = visual_nodes.iter().map(|n| n.id.as_str()).collect();

                for rel in &self.model.relationships {
                    if rel.kind == RelationKind::ModuleDependency {
                        if visible_ids.contains(rel.source.as_str()) && visible_ids.contains(rel.target.as_str()) {
                            // If filtering with boundary, ensure at least one endpoint is in core_ids
                            if !has_filter || !include_external || core_ids.contains(&rel.source) || core_ids.contains(&rel.target) {
                                visual_edges.push(VisualGraphEdge {
                                    id: rel.id.clone(),
                                    source: rel.source.clone(),
                                    target: rel.target.clone(),
                                    label: rel.description.clone(),
                                    kind: rel.kind.clone(),
                                    highlight_state: EdgeHighlightState::Normal,
                                    is_circular: rel.is_circular,
                                });
                            }
                        }
                    }
                }
            }
            "packages" => {
                let mut core_ids: HashSet<String> = HashSet::new();
                for p in &self.model.packages {
                    let mod_ok = match &mod_set {
                        Some(ms) => ms.contains(p.module_name.as_str()),
                        None => true,
                    };
                    let pkg_ok = match &pkg_set {
                        Some(ps) => ps.contains(p.id.as_str()),
                        None => true,
                    };
                    if mod_ok && pkg_ok {
                        core_ids.insert(p.id.clone());
                    }
                }

                // If include_external, find neighbor packages that connect with core_ids
                let mut boundary_ids: HashSet<String> = HashSet::new();
                if include_external && has_filter {
                    for rel in &self.model.relationships {
                        if rel.kind == RelationKind::PackageDependency {
                            let src_in = core_ids.contains(&rel.source);
                            let tgt_in = core_ids.contains(&rel.target);
                            if src_in && !tgt_in {
                                boundary_ids.insert(rel.target.clone());
                            } else if !src_in && tgt_in {
                                boundary_ids.insert(rel.source.clone());
                            }
                        }
                    }
                }

                for p in &self.model.packages {
                    let is_core = core_ids.contains(&p.id);
                    let is_ext = boundary_ids.contains(&p.id);

                    if is_core || is_ext {
                        let (ca, ce, i_val) = p
                            .metrics
                            .as_ref()
                            .map(|m| (m.afferent_coupling, m.efferent_coupling, m.instability))
                            .unwrap_or((0, 0, 0.0));

                        visual_nodes.push(VisualGraphNode {
                            id: p.id.clone(),
                            label: p.name.clone(),
                            sub_label: Some(format!("{} classes", p.class_ids.len())),
                            category: "package".to_string(),
                            layer: None,
                            group: if p.module_name.is_empty() { None } else { Some(p.module_name.clone()) },
                            highlight_state: NodeHighlightState::Normal,
                            degree_in: ca,
                            degree_out: ce,
                            metrics_summary: Some(format!("Ca: {}, Ce: {}, I: {:.2}", ca, ce, i_val)),
                            file_path: None,
                            line_number: None,
                            is_external: Some(is_ext),
                        });
                    }
                }

                let visible_ids: HashSet<&str> = visual_nodes.iter().map(|n| n.id.as_str()).collect();

                for rel in &self.model.relationships {
                    if rel.kind == RelationKind::PackageDependency {
                        if visible_ids.contains(rel.source.as_str()) && visible_ids.contains(rel.target.as_str()) {
                            if !has_filter || !include_external || core_ids.contains(&rel.source) || core_ids.contains(&rel.target) {
                                visual_edges.push(VisualGraphEdge {
                                    id: rel.id.clone(),
                                    source: rel.source.clone(),
                                    target: rel.target.clone(),
                                    label: rel.description.clone(),
                                    kind: rel.kind.clone(),
                                    highlight_state: EdgeHighlightState::Normal,
                                    is_circular: rel.is_circular,
                                });
                            }
                        }
                    }
                }
            }
            _ => {
                // "classes" view
                let mut core_ids: HashSet<String> = HashSet::new();
                for c in &self.model.classes {
                    let mod_ok = match &mod_set {
                        Some(ms) => ms.contains(c.module_name.as_str()),
                        None => true,
                    };
                    let pkg_ok = match &pkg_set {
                        Some(ps) => ps.contains(c.package_name.as_str()),
                        None => true,
                    };
                    if mod_ok && pkg_ok {
                        core_ids.insert(c.id.clone());
                    }
                }

                // If include_external, find neighbor classes outside core_ids that connect with core_ids
                let mut boundary_ids: HashSet<String> = HashSet::new();
                if include_external && has_filter {
                    for rel in &self.model.relationships {
                        if rel.kind != RelationKind::ModuleDependency && rel.kind != RelationKind::PackageDependency {
                            let src_in = core_ids.contains(&rel.source);
                            let tgt_in = core_ids.contains(&rel.target);
                            if src_in && !tgt_in {
                                boundary_ids.insert(rel.target.clone());
                            } else if !src_in && tgt_in {
                                boundary_ids.insert(rel.source.clone());
                            }
                        }
                    }
                }

                for c in &self.model.classes {
                    let is_core = core_ids.contains(&c.id);
                    let is_ext = boundary_ids.contains(&c.id);

                    if is_core || is_ext {
                        let cat = match c.kind {
                            ClassKind::Interface => "interface",
                            ClassKind::AbstractClass => "abstract_class",
                            ClassKind::Enum => "enum",
                            ClassKind::Record => "record",
                            ClassKind::Annotation => "annotation",
                            ClassKind::Class => "class",
                        };

                        let annotations_summary = if !c.annotations.is_empty() {
                            format!("@{}", c.annotations.join(", @"))
                        } else {
                            format!("{} LOC", c.loc)
                        };

                        visual_nodes.push(VisualGraphNode {
                            id: c.id.clone(),
                            label: c.name.clone(),
                            sub_label: Some(annotations_summary),
                            category: cat.to_string(),
                            layer: Some(c.layer.clone()),
                            group: Some(c.package_name.clone()),
                            highlight_state: NodeHighlightState::Normal,
                            degree_in: 0,
                            degree_out: 0,
                            metrics_summary: Some(format!("{} fields, {} methods", c.fields.len(), c.methods.len())),
                            file_path: Some(c.file_path.clone()),
                            line_number: Some(c.line_number),
                            is_external: Some(is_ext),
                        });
                    }
                }

                let visible_ids: HashSet<&str> = visual_nodes.iter().map(|n| n.id.as_str()).collect();

                for rel in &self.model.relationships {
                    if rel.kind != RelationKind::ModuleDependency
                        && rel.kind != RelationKind::PackageDependency
                    {
                        if visible_ids.contains(rel.source.as_str()) && visible_ids.contains(rel.target.as_str()) {
                            if !has_filter || !include_external || core_ids.contains(&rel.source) || core_ids.contains(&rel.target) {
                                visual_edges.push(VisualGraphEdge {
                                    id: rel.id.clone(),
                                    source: rel.source.clone(),
                                    target: rel.target.clone(),
                                    label: rel.description.clone(),
                                    kind: rel.kind.clone(),
                                    highlight_state: EdgeHighlightState::Normal,
                                    is_circular: rel.is_circular,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Calculate degrees for visible nodes
        let mut deg_in: HashMap<String, usize> = HashMap::new();
        let mut deg_out: HashMap<String, usize> = HashMap::new();
        for e in &visual_edges {
            *deg_out.entry(e.source.clone()).or_default() += 1;
            *deg_in.entry(e.target.clone()).or_default() += 1;
        }
        for n in &mut visual_nodes {
            n.degree_in = *deg_in.get(&n.id).unwrap_or(&0);
            n.degree_out = *deg_out.get(&n.id).unwrap_or(&0);
        }

        // 2. If a node is selected, apply the Highlight & Isolation Engine
        let total_nodes = visual_nodes.len();
        let total_edges = visual_edges.len();
        let cycles = self.find_cycles(view_type);
        let cycles_count = cycles.len();

        if let Some(target_id) = selected_id {
            let mut forward_adj: HashMap<&str, Vec<&str>> = HashMap::new();
            let mut backward_adj: HashMap<&str, Vec<&str>> = HashMap::new();

            for e in &visual_edges {
                forward_adj
                    .entry(e.source.as_str())
                    .or_default()
                    .push(e.target.as_str());
                backward_adj
                    .entry(e.target.as_str())
                    .or_default()
                    .push(e.source.as_str());
            }

            // Outbound BFS
            let mut outbound_nodes: HashSet<String> = HashSet::new();
            let mut q: VecDeque<(&str, u32)> = VecDeque::new();
            q.push_back((target_id, 0));
            while let Some((curr, d)) = q.pop_front() {
                if d < depth {
                    if let Some(neighbors) = forward_adj.get(curr) {
                        for &next in neighbors {
                            if next != target_id && outbound_nodes.insert(next.to_string()) {
                                q.push_back((next, d + 1));
                            }
                        }
                    }
                }
            }

            // Inbound BFS
            let mut inbound_nodes: HashSet<String> = HashSet::new();
            let mut q_in: VecDeque<(&str, u32)> = VecDeque::new();
            q_in.push_back((target_id, 0));
            while let Some((curr, d)) = q_in.pop_front() {
                if d < depth {
                    if let Some(neighbors) = backward_adj.get(curr) {
                        for &prev in neighbors {
                            if prev != target_id && inbound_nodes.insert(prev.to_string()) {
                                q_in.push_back((prev, d + 1));
                            }
                        }
                    }
                }
            }

            // Classify nodes
            for node in &mut visual_nodes {
                if node.id == target_id {
                    node.highlight_state = NodeHighlightState::Selected;
                } else if inbound_nodes.contains(&node.id) && outbound_nodes.contains(&node.id) {
                    node.highlight_state = NodeHighlightState::MutualActive;
                } else if inbound_nodes.contains(&node.id) {
                    node.highlight_state = NodeHighlightState::InboundActive;
                } else if outbound_nodes.contains(&node.id) {
                    node.highlight_state = NodeHighlightState::OutboundActive;
                } else {
                    node.highlight_state = NodeHighlightState::Dimmed;
                }
            }

            // Classify edges
            for edge in &mut visual_edges {
                if edge.source == target_id && edge.target == target_id {
                    edge.highlight_state = EdgeHighlightState::InboundActive;
                } else if edge.source == target_id {
                    edge.highlight_state = EdgeHighlightState::OutboundActive;
                } else if edge.target == target_id {
                    edge.highlight_state = EdgeHighlightState::InboundActive;
                } else if outbound_nodes.contains(&edge.source) && outbound_nodes.contains(&edge.target) {
                    edge.highlight_state = EdgeHighlightState::OutboundActive;
                } else if inbound_nodes.contains(&edge.source) && inbound_nodes.contains(&edge.target) {
                    edge.highlight_state = EdgeHighlightState::InboundActive;
                } else {
                    edge.highlight_state = EdgeHighlightState::Dimmed;
                }

                if edge.is_circular && (edge.source == target_id || edge.target == target_id) {
                    edge.highlight_state = EdgeHighlightState::CircularActive;
                }
            }

            if isolate_mode {
                visual_nodes.retain(|n| n.highlight_state != NodeHighlightState::Dimmed);
                let remaining_node_ids: HashSet<&str> = visual_nodes.iter().map(|n| n.id.as_str()).collect();
                visual_edges.retain(|e| {
                    remaining_node_ids.contains(e.source.as_str())
                        && remaining_node_ids.contains(e.target.as_str())
                        && e.highlight_state != EdgeHighlightState::Dimmed
                });
            }
        }

        VisualGraphPayload {
            view_type: view_type.to_string(),
            nodes: visual_nodes,
            edges: visual_edges,
            selected_node_id: selected_id.map(String::from),
            total_nodes,
            total_edges,
            cycles_count,
        }
    }

    // -------------------------------------------------------------
    // ARCHITECTURE INTELLIGENCE ENGINES
    // -------------------------------------------------------------

    /// 1. IMPACT ANALYSIS: Calculate Blast Radius & Risk of changing a target class
    pub fn calculate_impact_analysis(&self, target_id: &str) -> ImpactAnalysis {
        let target_class = self.model.classes.iter().find(|c| c.id == target_id);
        let target_name = target_class.map(|c| c.name.clone()).unwrap_or_else(|| target_id.to_string());

        let mut class_map: HashMap<String, &ClassInfo> = HashMap::new();
        for c in &self.model.classes {
            class_map.insert(c.id.clone(), c);
        }

        // Build backward graph (who depends on target?)
        let mut backward_adj: HashMap<&str, Vec<&str>> = HashMap::new();
        for rel in &self.model.relationships {
            if rel.kind != RelationKind::ModuleDependency && rel.kind != RelationKind::PackageDependency {
                backward_adj.entry(rel.target.as_str()).or_default().push(rel.source.as_str());
            }
        }

        let mut visited: HashSet<String> = HashSet::new();
        let mut affected_elements: Vec<AffectedElement> = Vec::new();
        let mut affected_packages: HashSet<String> = HashSet::new();
        let mut affected_modules: HashSet<String> = HashSet::new();
        let mut affected_layers: HashSet<ArchitectureLayer> = HashSet::new();

        let mut direct_dependents_count = 0;

        let mut q: VecDeque<(&str, u32)> = VecDeque::new();
        q.push_back((target_id, 0));

        while let Some((curr_id, depth)) = q.pop_front() {
            if let Some(dependents) = backward_adj.get(curr_id) {
                for &dep_id in dependents {
                    if dep_id != target_id && visited.insert(dep_id.to_string()) {
                        if depth == 0 {
                            direct_dependents_count += 1;
                        }

                        if let Some(cls) = class_map.get(dep_id) {
                            affected_packages.insert(cls.package_name.clone());
                            if !cls.module_name.is_empty() {
                                affected_modules.insert(cls.module_name.clone());
                            }
                            affected_layers.insert(cls.layer.clone());

                            let cat = match cls.kind {
                                ClassKind::Interface => "Interface",
                                ClassKind::AbstractClass => "AbstractClass",
                                _ => "Class",
                            };

                            affected_elements.push(AffectedElement {
                                id: cls.id.clone(),
                                name: cls.name.clone(),
                                category: cat.to_string(),
                                layer: cls.layer.clone(),
                                depth: depth + 1,
                            });
                        }

                        q.push_back((dep_id, depth + 1));
                    }
                }
            }
        }

        // Calculate Risk Score (0..100)
        let total_affected = affected_elements.len();
        let modules_count = affected_modules.len();
        let mut risk_score: u32 = 10;
        let mut risk_factors = Vec::new();

        if direct_dependents_count > 5 {
            risk_score += 25;
            risk_factors.push(format!("Пряма залежність від {} класів (High Fan-In)", direct_dependents_count));
        } else if direct_dependents_count > 0 {
            risk_score += direct_dependents_count as u32 * 4;
        }

        if total_affected > 20 {
            risk_score += 35;
            risk_factors.push(format!("Велика площа ураження (Blast Radius): {} класів під загрозою", total_affected));
        } else if total_affected > 5 {
            risk_score += (total_affected * 2) as u32;
        }

        if modules_count > 2 {
            risk_score += 20;
            risk_factors.push(format!("Зміни зачіпають {} різних модулів", modules_count));
        }

        let touches_ui = affected_layers.contains(&ArchitectureLayer::UI);
        if touches_ui {
            risk_score += 15;
            risk_factors.push("Зміни транслюються безпосередньо у рівень інтерфейсу/контролерів".to_string());
        }

        if risk_score > 100 {
            risk_score = 100;
        }

        let risk_level = if risk_score >= 70 {
            RiskLevel::Critical
        } else if risk_score >= 45 {
            RiskLevel::High
        } else if risk_score >= 20 {
            RiskLevel::Medium
        } else {
            RiskLevel::Low
        };

        if risk_factors.is_empty() {
            risk_factors.push("Локалізовані зміни з мінімальним транзитивним впливом".to_string());
        }

        ImpactAnalysis {
            target_id: target_id.to_string(),
            target_name,
            direct_dependents_count,
            total_affected_classes: total_affected,
            total_affected_modules: modules_count,
            total_affected_packages: affected_packages.len(),
            risk_level,
            risk_score,
            risk_factors,
            affected_classes: affected_elements,
            affected_modules: affected_modules.into_iter().collect(),
            affected_packages: affected_packages.into_iter().collect(),
            affected_layers: affected_layers.into_iter().collect(),
        }
    }

    /// 2. ARCHITECTURE DRIFT: Detect layer violations (e.g. UI -> DAO skipping Service)
    pub fn detect_architecture_drift(&self) -> Vec<ArchitectureViolation> {
        let mut class_layer: HashMap<String, ArchitectureLayer> = HashMap::new();
        for c in &self.model.classes {
            class_layer.insert(c.id.clone(), c.layer.clone());
        }

        let mut violations = Vec::new();
        let mut v_counter = 1;

        for rel in &self.model.relationships {
            if rel.kind == RelationKind::ModuleDependency || rel.kind == RelationKind::PackageDependency {
                continue;
            }

            if let (Some(src_layer), Some(tgt_layer)) = (class_layer.get(&rel.source), class_layer.get(&rel.target)) {
                // Rule 1: UI cannot directly depend on Infrastructure (DAO / Repository)
                if *src_layer == ArchitectureLayer::UI && *tgt_layer == ArchitectureLayer::Infrastructure {
                    violations.push(ArchitectureViolation {
                        id: format!("violation-{}", v_counter),
                        source_class: rel.source.clone(),
                        target_class: rel.target.clone(),
                        from_layer: ArchitectureLayer::UI,
                        to_layer: ArchitectureLayer::Infrastructure,
                        violation_title: "UI обходить сервісний шар (UI -> DAO direct call)".to_string(),
                        expected_flow: "UI → Service → Infrastructure (DAO/Repository)".to_string(),
                        actual_flow: "UI → Infrastructure (Direct Bypass)".to_string(),
                        severity: ViolationSeverity::Critical,
                        explanation: format!(
                            "Контролер/UI клас '{}' напряму звертається до репозиторію '{}' в обхід бізнес-логіки.",
                            rel.source.split('.').last().unwrap_or(&rel.source),
                            rel.target.split('.').last().unwrap_or(&rel.target)
                        ),
                    });
                    v_counter += 1;
                }

                // Rule 2: Domain cannot depend on UI or Infrastructure (Clean Architecture / DIP)
                if *src_layer == ArchitectureLayer::Domain && (*tgt_layer == ArchitectureLayer::UI || *tgt_layer == ArchitectureLayer::Infrastructure) {
                    violations.push(ArchitectureViolation {
                        id: format!("violation-{}", v_counter),
                        source_class: rel.source.clone(),
                        target_class: rel.target.clone(),
                        from_layer: ArchitectureLayer::Domain,
                        to_layer: tgt_layer.clone(),
                        violation_title: "Порушення чистоти домену (Domain -> UI/Infra)".to_string(),
                        expected_flow: "Domain не повинен залежати від деталей реалізації або UI".to_string(),
                        actual_flow: format!("Domain → {:?}", tgt_layer),
                        severity: ViolationSeverity::High,
                        explanation: format!(
                            "Доменна сутність '{}' має пряму залежність від '{}', що порушує ізоляцію ядра.",
                            rel.source.split('.').last().unwrap_or(&rel.source),
                            rel.target.split('.').last().unwrap_or(&rel.target)
                        ),
                    });
                    v_counter += 1;
                }

                // Rule 3: Infrastructure cannot depend on UI
                if *src_layer == ArchitectureLayer::Infrastructure && *tgt_layer == ArchitectureLayer::UI {
                    violations.push(ArchitectureViolation {
                        id: format!("violation-{}", v_counter),
                        source_class: rel.source.clone(),
                        target_class: rel.target.clone(),
                        from_layer: ArchitectureLayer::Infrastructure,
                        to_layer: ArchitectureLayer::UI,
                        violation_title: "Зворотне порушення залежностей (Infra -> UI)".to_string(),
                        expected_flow: "Infrastructure не має знати про рівень представлення".to_string(),
                        actual_flow: "Infrastructure → UI".to_string(),
                        severity: ViolationSeverity::Critical,
                        explanation: format!(
                            "Клас інфраструктури '{}' посилається на UI-компонент '{}'.",
                            rel.source.split('.').last().unwrap_or(&rel.source),
                            rel.target.split('.').last().unwrap_or(&rel.target)
                        ),
                    });
                    v_counter += 1;
                }
            }
        }

        violations
    }

    /// 3. MICROSERVICE EXTRACTION: Analyze blockers and readiness to extract a module/package
    pub fn analyze_microservice_extraction(&self, target_id: &str) -> MicroserviceExtractionAnalysis {
        let is_module = self.model.modules.iter().any(|m| m.id == target_id);
        let is_class = self.model.classes.iter().any(|c| c.id == target_id);

        let target_classes: HashSet<String> = if is_module {
            self.model.classes.iter().filter(|c| c.module_name == target_id).map(|c| c.id.clone()).collect()
        } else if is_class {
            let mut set = HashSet::new();
            set.insert(target_id.to_string());
            set
        } else {
            self.model
                .classes
                .iter()
                .filter(|c| c.package_name == target_id || c.package_name.starts_with(&format!("{}.", target_id)))
                .map(|c| c.id.clone())
                .collect()
        };

        let target_name = target_id.to_string();
        let total_classes = target_classes.len();

        let mut inbound_blockers = Vec::new();
        let mut outbound_blockers = Vec::new();
        let mut seen_inbound = HashSet::new();
        let mut seen_outbound = HashSet::new();
        let mut external_dependencies_count = 0;

        for rel in &self.model.relationships {
            if rel.kind == RelationKind::ModuleDependency || rel.kind == RelationKind::PackageDependency {
                continue;
            }

            let src_in = target_classes.contains(&rel.source);
            let tgt_in = target_classes.contains(&rel.target);

            // Inbound blocker: outside -> inside
            if !src_in && tgt_in {
                let pair_key = format!("{}->{}", rel.source, rel.target);
                if seen_inbound.insert(pair_key) {
                    inbound_blockers.push(ExtractionBlocker {
                        source: rel.source.clone(),
                        target: rel.target.clone(),
                        description: format!("Зовнішній клас '{}' викликає внутрішній '{}'", rel.source.split('.').last().unwrap_or(&rel.source), rel.target.split('.').last().unwrap_or(&rel.target)),
                        blocker_type: "Inbound Dependency".to_string(),
                        solution_hint: "Обернути в REST/gRPC API або винести інтерфейс клієнта".to_string(),
                    });
                }
            }

            // Outbound blocker: inside -> outside
            if src_in && !tgt_in {
                external_dependencies_count += 1;
                let pair_key = format!("{}->{}", rel.source, rel.target);
                if seen_outbound.insert(pair_key) {
                    outbound_blockers.push(ExtractionBlocker {
                        source: rel.source.clone(),
                        target: rel.target.clone(),
                        description: format!("Внутрішній клас '{}' залежить від зовнішнього '{}'", rel.source.split('.').last().unwrap_or(&rel.source), rel.target.split('.').last().unwrap_or(&rel.target)),
                        blocker_type: "Outbound Tight Coupling".to_string(),
                        solution_hint: "Застосувати патерн Event-Driven Messaging або ін'єкцію через адаптер".to_string(),
                    });
                }
            }
        }

        let total_blockers = inbound_blockers.len() + outbound_blockers.len();
        let mut readiness_score: u32 = 100;
        if total_blockers > 0 {
            let penalty = (total_blockers * 7).min(85) as u32;
            readiness_score = readiness_score.saturating_sub(penalty);
        }

        let is_cleanly_extractable = total_blockers <= 2;

        let mut suggested_order = Vec::new();
        suggested_order.push("1. Ізолювати публічний API та створити контракт DTO/REST".to_string());
        if !inbound_blockers.is_empty() {
            suggested_order.push(format!("2. Замінити {} прямих вхідних звернень на виклики клієнта", inbound_blockers.len()));
        }
        if !outbound_blockers.is_empty() {
            suggested_order.push(format!("3. Розв'язати {} вихідних жорстких зв'язків через асинхронні події або фасади", outbound_blockers.len()));
        }
        suggested_order.push("4. Відокремити схему БД та міграції для незалежного розгортання".to_string());

        MicroserviceExtractionAnalysis {
            target_id: target_id.to_string(),
            target_name,
            target_type: if is_module { "Module".to_string() } else { "Package".to_string() },
            total_classes,
            readiness_score,
            is_cleanly_extractable,
            inbound_blockers,
            outbound_blockers,
            shared_dependencies_count: external_dependencies_count,
            suggested_extraction_order: suggested_order,
        }
    }

    /// 4. ARCHITECTURE HEALTH: Overall system health score & grade
    pub fn calculate_architecture_health(&self) -> ArchitectureHealth {
        let cycles = self.find_cycles("classes");
        let violations = self.detect_architecture_drift();

        // Detect God classes (> 8 outbound or > 12 total dependencies)
        let mut deg: HashMap<String, usize> = HashMap::new();
        for rel in &self.model.relationships {
            if rel.kind != RelationKind::ModuleDependency && rel.kind != RelationKind::PackageDependency {
                *deg.entry(rel.source.clone()).or_default() += 1;
                *deg.entry(rel.target.clone()).or_default() += 1;
            }
        }

        let mut god_classes = Vec::new();
        for (c_id, count) in &deg {
            if *count >= 8 {
                god_classes.push(c_id.clone());
            }
        }

        let mut score: i32 = 100;
        let mut recommendations = Vec::new();

        // Penalty for cycles
        if !cycles.is_empty() {
            score -= (cycles.len() * 8) as i32;
            recommendations.push(format!("Розірвати {} циклічних контурів за допомогою інтерфейсів або інверсії залежностей (DIP)", cycles.len()));
        }

        // Penalty for drift violations
        if !violations.is_empty() {
            score -= (violations.len() * 5) as i32;
            recommendations.push(format!("Усунути {} архітектурних порушень шарів (UI не повинен обходити Service шар)", violations.len()));
        }

        // Penalty for God Classes
        if !god_classes.is_empty() {
            score -= (god_classes.len() * 4) as i32;
            recommendations.push(format!("Провести декомпозицію {} перевантажених класів (God Classes)", god_classes.len()));
        }

        if score < 0 {
            score = 0;
        }
        let final_score = score as u32;

        let grade = if final_score >= 90 {
            "A+".to_string()
        } else if final_score >= 80 {
            "A".to_string()
        } else if final_score >= 70 {
            "B".to_string()
        } else if final_score >= 60 {
            "C".to_string()
        } else if final_score >= 50 {
            "D".to_string()
        } else {
            "F".to_string()
        };

        if recommendations.is_empty() {
            recommendations.push("Архітектура чиста, модульна та відповідає правилам багатошарової розробки.".to_string());
        }

        ArchitectureHealth {
            score: final_score,
            grade,
            total_classes: self.model.classes.len(),
            total_modules: self.model.modules.len(),
            total_packages: self.model.packages.len(),
            cyclic_dependencies_count: cycles.len(),
            architecture_violations_count: violations.len(),
            god_classes_count: god_classes.len(),
            god_classes,
            key_recommendations: recommendations,
        }
    }

    /// 5. SNAPSHOT: Create source-safe architecture snapshot without exposing raw code
    pub fn create_architecture_snapshot(&self) -> ArchitectureSnapshot {
        let health = self.calculate_architecture_health();
        let violations = self.detect_architecture_drift();
        let cycles = self.find_cycles("classes");

        let mut layers_dist: HashMap<String, usize> = HashMap::new();
        for c in &self.model.classes {
            let l_str = match c.layer {
                ArchitectureLayer::UI => "UI",
                ArchitectureLayer::Service => "Service",
                ArchitectureLayer::Domain => "Domain",
                ArchitectureLayer::Infrastructure => "Infrastructure",
                ArchitectureLayer::Unknown => "Other",
            };
            *layers_dist.entry(l_str.to_string()).or_default() += 1;
        }

        ArchitectureSnapshot {
            project_name: self.model.project_name.clone(),
            scan_timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
            health,
            modules_count: self.model.modules.len(),
            packages_count: self.model.packages.len(),
            classes_count: self.model.classes.len(),
            relationships_count: self.model.relationships.len(),
            violations,
            cycles,
            layers_distribution: layers_dist,
        }
    }

    /// 6. CALL HIERARCHY: Build interactive method & field call hierarchy with configurable depth
    pub fn build_call_hierarchy(&self, target_id: &str, max_depth: u32) -> CallHierarchyGraph {
        let max_d = max_depth.clamp(1, 10);
        let mut nodes_map: HashMap<String, CallHierarchyNode> = HashMap::new();
        let mut edges: Vec<CallHierarchyEdge> = Vec::new();
        let mut visited_edges: HashSet<(String, String)> = HashSet::new();

        // 1. Identify Root Member
        // target_id can be "FQCN#member" or "member" or "FQCN#member(paramTypes)"
        let (target_class_fqcn, target_member_name) = if target_id.contains('#') {
            let mut parts = target_id.split('#');
            (parts.next().unwrap_or(""), parts.next().unwrap_or(""))
        } else {
            ("", target_id)
        };

        // Clean member name from parameters if any: "findOwner(String)" -> "findOwner"
        let clean_member_name = target_member_name.split('(').next().unwrap_or(target_member_name).trim();

        // Find root member across classes
        let mut root_node: Option<CallHierarchyNode> = None;
        let mut root_full_id = target_id.to_string();
        let mut root_type = "method".to_string();

        for cls in &self.model.classes {
            if !target_class_fqcn.is_empty() && cls.id != target_class_fqcn && !cls.name.eq_ignore_ascii_case(target_class_fqcn) {
                continue;
            }

            // Check methods
            if let Some(m) = cls.methods.iter().find(|m| m.id == target_id || m.name == clean_member_name || m.name == target_member_name) {
                root_full_id = m.id.clone();
                root_type = "method".to_string();
                root_node = Some(CallHierarchyNode {
                    id: m.id.clone(),
                    name: m.name.clone(),
                    declaring_class: cls.id.clone(),
                    class_simple_name: cls.name.clone(),
                    member_type: "method".to_string(),
                    layer: cls.layer,
                    depth: 0,
                    signature: Some(format!("{}({}) -> {}", m.name, m.parameters.iter().map(|p| format!("{} {}", p.type_name, p.name)).collect::<Vec<_>>().join(", "), m.return_type)),
                    return_or_field_type: Some(m.return_type.clone()),
                });
                break;
            }

            // Check fields
            if let Some(f) = cls.fields.iter().find(|f| f.id == target_id || f.name == clean_member_name || f.name == target_member_name) {
                root_full_id = f.id.clone();
                root_type = "field".to_string();
                root_node = Some(CallHierarchyNode {
                    id: f.id.clone(),
                    name: f.name.clone(),
                    declaring_class: cls.id.clone(),
                    class_simple_name: cls.name.clone(),
                    member_type: "field".to_string(),
                    layer: cls.layer,
                    depth: 0,
                    signature: Some(format!("{} {}", f.type_name, f.name)),
                    return_or_field_type: Some(f.type_name.clone()),
                });
                break;
            }
        }

        // Fallback root if not directly found in classes
        let root = root_node.unwrap_or_else(|| {
            CallHierarchyNode {
                id: root_full_id.clone(),
                name: clean_member_name.to_string(),
                declaring_class: target_class_fqcn.to_string(),
                class_simple_name: target_class_fqcn.split('.').last().unwrap_or(target_class_fqcn).to_string(),
                member_type: root_type.clone(),
                layer: ArchitectureLayer::Unknown,
                depth: 0,
                signature: None,
                return_or_field_type: None,
            }
        });

        nodes_map.insert(root.id.clone(), root.clone());

        // 2. INBOUND CALLERS BFS: Who calls this member (up to max_depth)?
        let mut inbound_queue: VecDeque<(String, String, u32)> = VecDeque::new();
        inbound_queue.push_back((root.id.clone(), root.name.clone(), 0));
        let mut visited_inbound: HashSet<String> = HashSet::new();
        visited_inbound.insert(root.id.clone());

        while let Some((curr_id, curr_name, curr_d)) = inbound_queue.pop_front() {
            if curr_d >= max_d {
                continue;
            }

            let next_depth = curr_d + 1;
            let clean_curr = curr_name.split('(').next().unwrap_or(&curr_name).trim();

            for cls in &self.model.classes {
                for m in &cls.methods {
                    if m.id == curr_id {
                        continue;
                    }

                    let calls_curr = m.called_methods.iter().any(|cm| {
                        cm == &curr_id || cm.ends_with(&format!("#{}", clean_curr)) || cm == clean_curr
                    });
                    let uses_curr_field = m.used_fields.iter().any(|uf| uf == clean_curr);

                    if calls_curr || uses_curr_field {
                        let caller_node_id = m.id.clone();
                        if !nodes_map.contains_key(&caller_node_id) {
                            nodes_map.insert(
                                caller_node_id.clone(),
                                CallHierarchyNode {
                                    id: caller_node_id.clone(),
                                    name: m.name.clone(),
                                    declaring_class: cls.id.clone(),
                                    class_simple_name: cls.name.clone(),
                                    member_type: "method".to_string(),
                                    layer: cls.layer,
                                    depth: -(next_depth as i32),
                                    signature: Some(format!("{}({}) -> {}", m.name, m.parameters.iter().map(|p| format!("{} {}", p.type_name, p.name)).collect::<Vec<_>>().join(", "), m.return_type)),
                                    return_or_field_type: Some(m.return_type.clone()),
                                },
                            );
                        }

                        let edge_key = (caller_node_id.clone(), curr_id.clone());
                        if visited_edges.insert(edge_key) {
                            edges.push(CallHierarchyEdge {
                                id: format!("call-in-{}-{}", caller_node_id, curr_id),
                                source: caller_node_id.clone(),
                                target: curr_id.clone(),
                                call_kind: if uses_curr_field { "FieldAccess".to_string() } else { "MethodCall".to_string() },
                                label: Some(if uses_curr_field { "accesses field" } else { "calls" }.to_string()),
                            });
                        }

                        if visited_inbound.insert(caller_node_id.clone()) {
                            inbound_queue.push_back((caller_node_id, m.name.clone(), next_depth));
                        }
                    }
                }
            }
        }

        // 3. OUTBOUND CALLEES BFS: What does this member call (up to max_depth)?
        let mut outbound_queue: VecDeque<(String, u32)> = VecDeque::new();
        outbound_queue.push_back((root.id.clone(), 0));
        let mut visited_outbound: HashSet<String> = HashSet::new();
        visited_outbound.insert(root.id.clone());

        while let Some((curr_id, curr_d)) = outbound_queue.pop_front() {
            if curr_d >= max_d {
                continue;
            }

            let next_depth = curr_d + 1;

            let mut curr_method: Option<&MethodInfo> = None;
            let mut declaring_cls_opt: Option<&ClassInfo> = None;
            for cls in &self.model.classes {
                if let Some(m) = cls.methods.iter().find(|m| m.id == curr_id) {
                    curr_method = Some(m);
                    declaring_cls_opt = Some(cls);
                    break;
                }
            }

            if let (Some(m), Some(_decl_cls)) = (curr_method, declaring_cls_opt) {
                // A. Check called methods
                for called_ref in &m.called_methods {
                    let (called_cls_name, called_m_name) = if called_ref.contains('#') {
                        let mut p = called_ref.split('#');
                        (p.next().unwrap_or(""), p.next().unwrap_or(""))
                    } else {
                        ("", called_ref.as_str())
                    };

                    let clean_callee_name = called_m_name.split('(').next().unwrap_or(called_m_name).trim();

                    for target_cls in &self.model.classes {
                        if !called_cls_name.is_empty() && target_cls.name != called_cls_name && target_cls.id != called_cls_name {
                            continue;
                        }

                        if let Some(target_m) = target_cls.methods.iter().find(|tm| tm.name == clean_callee_name || tm.id == *called_ref) {
                            let callee_node_id = target_m.id.clone();
                            if !nodes_map.contains_key(&callee_node_id) {
                                nodes_map.insert(
                                    callee_node_id.clone(),
                                    CallHierarchyNode {
                                        id: callee_node_id.clone(),
                                        name: target_m.name.clone(),
                                        declaring_class: target_cls.id.clone(),
                                        class_simple_name: target_cls.name.clone(),
                                        member_type: "method".to_string(),
                                        layer: target_cls.layer,
                                        depth: next_depth as i32,
                                        signature: Some(format!("{}({}) -> {}", target_m.name, target_m.parameters.iter().map(|p| format!("{} {}", p.type_name, p.name)).collect::<Vec<_>>().join(", "), target_m.return_type)),
                                        return_or_field_type: Some(target_m.return_type.clone()),
                                    },
                                );
                            }

                            let edge_key = (curr_id.clone(), callee_node_id.clone());
                            if visited_edges.insert(edge_key) {
                                edges.push(CallHierarchyEdge {
                                    id: format!("call-out-{}-{}", curr_id, callee_node_id),
                                    source: curr_id.clone(),
                                    target: callee_node_id.clone(),
                                    call_kind: "MethodCall".to_string(),
                                    label: Some("calls".to_string()),
                                });
                            }

                            if visited_outbound.insert(callee_node_id.clone()) {
                                outbound_queue.push_back((callee_node_id, next_depth));
                            }
                        }
                    }
                }

                // B. Check used fields
                for field_name in &m.used_fields {
                    for target_cls in &self.model.classes {
                        if let Some(target_f) = target_cls.fields.iter().find(|tf| tf.name == *field_name) {
                            let field_node_id = target_f.id.clone();
                            if !nodes_map.contains_key(&field_node_id) {
                                nodes_map.insert(
                                    field_node_id.clone(),
                                    CallHierarchyNode {
                                        id: field_node_id.clone(),
                                        name: target_f.name.clone(),
                                        declaring_class: target_cls.id.clone(),
                                        class_simple_name: target_cls.name.clone(),
                                        member_type: "field".to_string(),
                                        layer: target_cls.layer,
                                        depth: next_depth as i32,
                                        signature: Some(format!("{} {}", target_f.type_name, target_f.name)),
                                        return_or_field_type: Some(target_f.type_name.clone()),
                                    },
                                );
                            }

                            let edge_key = (curr_id.clone(), field_node_id.clone());
                            if visited_edges.insert(edge_key) {
                                edges.push(CallHierarchyEdge {
                                    id: format!("field-out-{}-{}", curr_id, field_node_id),
                                    source: curr_id.clone(),
                                    target: field_node_id.clone(),
                                    call_kind: "FieldAccess".to_string(),
                                    label: Some("accesses".to_string()),
                                });
                            }
                        }
                    }
                }
            }
        }

        CallHierarchyGraph {
            root_id: root.id.clone(),
            root_name: root.name.clone(),
            root_class: root.declaring_class.clone(),
            root_type: root.member_type.clone(),
            nodes: nodes_map.into_values().collect(),
            edges,
            max_depth: max_d,
        }
    }
}
