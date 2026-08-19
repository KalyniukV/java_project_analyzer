pub mod algorithms;
pub mod models;
pub mod storage;

pub use algorithms::GraphAnalyzer;
pub use models::*;
pub use storage::StorageManager;

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_project() -> ProjectModel {
        let mut model = ProjectModel::default();
        model.project_name = "test-project".to_string();
        model.root_path = "/test/root".to_string();

        // 2 Modules
        model.modules.push(ModuleInfo {
            id: "core-domain".to_string(),
            name: "core-domain".to_string(),
            path: "/test/core-domain".to_string(),
            build_type: "maven".to_string(),
            direct_dependencies: vec![],
            exported_packages: vec!["com.example.domain".to_string()],
            afferent_coupling: 0,
            efferent_coupling: 0,
            instability: 0.0,
        });
        model.modules.push(ModuleInfo {
            id: "api-service".to_string(),
            name: "api-service".to_string(),
            path: "/test/api-service".to_string(),
            build_type: "maven".to_string(),
            direct_dependencies: vec!["core-domain".to_string()],
            exported_packages: vec!["com.example.service".to_string()],
            afferent_coupling: 0,
            efferent_coupling: 0,
            instability: 0.0,
        });

        // 2 Packages
        model.packages.push(PackageInfo {
            id: "com.example.domain".to_string(),
            name: "com.example.domain".to_string(),
            module_name: "core-domain".to_string(),
            class_ids: vec!["com.example.domain.User".to_string()],
            subpackage_ids: vec![],
            metrics: None,
        });
        model.packages.push(PackageInfo {
            id: "com.example.service".to_string(),
            name: "com.example.service".to_string(),
            module_name: "api-service".to_string(),
            class_ids: vec![
                "com.example.service.UserService".to_string(),
                "com.example.service.UserController".to_string(),
                "com.example.service.UserDao".to_string(),
            ],
            subpackage_ids: vec![],
            metrics: None,
        });

        // 4 Classes with Layer information
        model.classes.push(ClassInfo {
            id: "com.example.domain.User".to_string(),
            name: "User".to_string(),
            package_name: "com.example.domain".to_string(),
            module_name: "core-domain".to_string(),
            layer: ArchitectureLayer::Domain,
            file_path: "/test/User.java".to_string(),
            line_number: 10,
            kind: ClassKind::Class,
            is_public: true,
            loc: 50,
            super_class: None,
            interfaces: vec![],
            annotations: vec![],
            fields: vec![],
            methods: vec![],
            referenced_types: vec![],
        });
        model.classes.push(ClassInfo {
            id: "com.example.service.UserService".to_string(),
            name: "UserService".to_string(),
            package_name: "com.example.service".to_string(),
            module_name: "api-service".to_string(),
            layer: ArchitectureLayer::Service,
            file_path: "/test/UserService.java".to_string(),
            line_number: 15,
            kind: ClassKind::Class,
            is_public: true,
            loc: 100,
            super_class: None,
            interfaces: vec![],
            annotations: vec!["Service".to_string()],
            fields: vec![FieldInfo {
                id: "com.example.service.UserService#user".to_string(),
                name: "user".to_string(),
                type_name: "com.example.domain.User".to_string(),
                is_injected: false,
                annotations: vec![],
                visibility: "private".to_string(),
                is_static: false,
            }],
            methods: vec![],
            referenced_types: vec!["com.example.domain.User".to_string()],
        });
        model.classes.push(ClassInfo {
            id: "com.example.service.UserController".to_string(),
            name: "UserController".to_string(),
            package_name: "com.example.service".to_string(),
            module_name: "api-service".to_string(),
            layer: ArchitectureLayer::UI,
            file_path: "/test/UserController.java".to_string(),
            line_number: 12,
            kind: ClassKind::Class,
            is_public: true,
            loc: 80,
            super_class: None,
            interfaces: vec![],
            annotations: vec!["RestController".to_string()],
            fields: vec![FieldInfo {
                id: "com.example.service.UserController#userService".to_string(),
                name: "userService".to_string(),
                type_name: "com.example.service.UserService".to_string(),
                is_injected: true,
                annotations: vec!["Autowired".to_string()],
                visibility: "private".to_string(),
                is_static: false,
            }],
            methods: vec![],
            referenced_types: vec!["com.example.service.UserService".to_string()],
        });
        model.classes.push(ClassInfo {
            id: "com.example.service.UserDao".to_string(),
            name: "UserDao".to_string(),
            package_name: "com.example.service".to_string(),
            module_name: "api-service".to_string(),
            layer: ArchitectureLayer::Infrastructure,
            file_path: "/test/UserDao.java".to_string(),
            line_number: 8,
            kind: ClassKind::Interface,
            is_public: true,
            loc: 30,
            super_class: None,
            interfaces: vec![],
            annotations: vec!["Repository".to_string()],
            fields: vec![],
            methods: vec![],
            referenced_types: vec![],
        });

        // Relationships: Controller -> Service -> User
        model.relationships.push(Relationship {
            id: "rel-1".to_string(),
            source: "com.example.service.UserController".to_string(),
            target: "com.example.service.UserService".to_string(),
            kind: RelationKind::FieldDependency,
            description: Some("@Autowired".to_string()),
            is_circular: false,
        });
        model.relationships.push(Relationship {
            id: "rel-2".to_string(),
            source: "com.example.service.UserService".to_string(),
            target: "com.example.domain.User".to_string(),
            kind: RelationKind::FieldDependency,
            description: Some("uses".to_string()),
            is_circular: false,
        });
        // Intentionally add an Architecture Violation (UI -> Infrastructure direct bypass)
        model.relationships.push(Relationship {
            id: "rel-violation".to_string(),
            source: "com.example.service.UserController".to_string(),
            target: "com.example.service.UserDao".to_string(),
            kind: RelationKind::FieldDependency,
            description: Some("direct dao bypass".to_string()),
            is_circular: false,
        });

        model
    }

    #[test]
    fn test_highlight_engine() {
        let model = create_test_project();
        let mut analyzer = GraphAnalyzer::new(model);
        analyzer.calculate_metrics();

        let graph = analyzer.build_visual_graph(
            "classes",
            Some("com.example.service.UserService"),
            1,
            false,
            None,
            None,
            false,
        );

        let user_service_node = graph.nodes.iter().find(|n| n.id == "com.example.service.UserService").unwrap();
        assert_eq!(user_service_node.highlight_state, NodeHighlightState::Selected);

        let user_controller_node = graph.nodes.iter().find(|n| n.id == "com.example.service.UserController").unwrap();
        assert_eq!(user_controller_node.highlight_state, NodeHighlightState::InboundActive);

        let user_node = graph.nodes.iter().find(|n| n.id == "com.example.domain.User").unwrap();
        assert_eq!(user_node.highlight_state, NodeHighlightState::OutboundActive);
    }

    #[test]
    fn test_module_and_package_scoping() {
        let model = create_test_project();
        let analyzer = GraphAnalyzer::new(model);

        // Filter packages by module "core-domain"
        let mod_filter = vec!["core-domain".to_string()];
        let pkg_graph = analyzer.build_visual_graph("packages", None, 1, false, Some(&mod_filter), None, false);
        assert_eq!(pkg_graph.nodes.len(), 1);
        assert_eq!(pkg_graph.nodes[0].id, "com.example.domain");

        // Filter classes by package "com.example.service" without external
        let pkg_filter = vec!["com.example.service".to_string()];
        let cls_graph = analyzer.build_visual_graph("classes", None, 1, false, None, Some(&pkg_filter), false);
        assert_eq!(cls_graph.nodes.len(), 3);
        assert!(cls_graph.nodes.iter().all(|n| n.group.as_deref() == Some("com.example.service")));

        // Filter classes with include_external = true -> should also pull in com.example.domain.User!
        let ext_graph = analyzer.build_visual_graph("classes", None, 1, false, None, Some(&pkg_filter), true);
        assert_eq!(ext_graph.nodes.len(), 4);
        let user_node = ext_graph.nodes.iter().find(|n| n.id == "com.example.domain.User").unwrap();
        assert_eq!(user_node.is_external, Some(true));
    }

    #[test]
    fn test_impact_analysis() {
        let model = create_test_project();
        let analyzer = GraphAnalyzer::new(model);

        // If we change User, what is affected?
        let impact = analyzer.calculate_impact_analysis("com.example.domain.User");
        assert_eq!(impact.target_name, "User");
        // UserService depends on User, and UserController depends on UserService -> total 2 affected
        assert_eq!(impact.total_affected_classes, 2);
        assert!(impact.affected_layers.contains(&ArchitectureLayer::UI));
        assert!(impact.risk_score > 0);
    }

    #[test]
    fn test_architecture_drift_detection() {
        let model = create_test_project();
        let analyzer = GraphAnalyzer::new(model);

        let violations = analyzer.detect_architecture_drift();
        assert_eq!(violations.len(), 1);
        let v = &violations[0];
        assert_eq!(v.from_layer, ArchitectureLayer::UI);
        assert_eq!(v.to_layer, ArchitectureLayer::Infrastructure);
        assert_eq!(v.source_class, "com.example.service.UserController");
        assert_eq!(v.target_class, "com.example.service.UserDao");
    }

    #[test]
    fn test_architecture_health_score() {
        let model = create_test_project();
        let analyzer = GraphAnalyzer::new(model);

        let health = analyzer.calculate_architecture_health();
        assert!(health.score <= 100);
        assert_eq!(health.architecture_violations_count, 1);
        assert!(!health.key_recommendations.is_empty());
    }

    #[test]
    fn test_nosql_storage() {
        let storage = StorageManager::open_temp().expect("Failed to create temp NoSQL DB");
        let model = create_test_project();

        // Save into NoSQL redb
        storage.save_project(&model).expect("Failed to save project");

        // Load back
        let loaded = storage.load_project(&model.root_path).expect("Failed to load project");
        assert!(loaded.is_some());
        let loaded_model = loaded.unwrap();
        assert_eq!(loaded_model.project_name, "test-project");
        assert_eq!(loaded_model.modules.len(), 2);
        assert_eq!(loaded_model.packages.len(), 2);
        assert_eq!(loaded_model.classes.len(), 4);
    }

    #[test]
    fn test_call_hierarchy_with_depth() {
        let mut model = create_test_project();
        
        // Add methods to UserService & UserController with call relationships
        let user_service = model.classes.iter_mut().find(|c| c.name == "UserService").unwrap();
        user_service.methods.push(MethodInfo {
            id: "com.example.service.UserService#getUser(Long)".to_string(),
            name: "getUser".to_string(),
            return_type: "User".to_string(),
            parameters: vec![ParameterInfo {
                name: "id".to_string(),
                type_name: "Long".to_string(),
                annotations: vec![],
            }],
            annotations: vec![],
            line_number: 20,
            visibility: "public".to_string(),
            is_static: false,
            called_methods: vec![],
            used_fields: vec!["user".to_string()],
        });

        let user_controller = model.classes.iter_mut().find(|c| c.name == "UserController").unwrap();
        user_controller.methods.push(MethodInfo {
            id: "com.example.service.UserController#handleGet(Long)".to_string(),
            name: "handleGet".to_string(),
            return_type: "User".to_string(),
            parameters: vec![ParameterInfo {
                name: "id".to_string(),
                type_name: "Long".to_string(),
                annotations: vec![],
            }],
            annotations: vec!["GetMapping".to_string()],
            line_number: 25,
            visibility: "public".to_string(),
            is_static: false,
            called_methods: vec!["UserService#getUser".to_string()],
            used_fields: vec!["userService".to_string()],
        });

        let analyzer = GraphAnalyzer::new(model);
        let hierarchy = analyzer.build_call_hierarchy("com.example.service.UserService#getUser(Long)", 2);

        assert_eq!(hierarchy.root_name, "getUser");
        assert!(hierarchy.nodes.len() >= 2, "Expected at least 2 nodes in hierarchy, got {}", hierarchy.nodes.len());
        
        // Check caller node
        let caller = hierarchy.nodes.iter().find(|n| n.name == "handleGet");
        assert!(caller.is_some(), "Caller handleGet should be found in hierarchy!");
        assert_eq!(caller.unwrap().depth, -1);
    }
}
