package com.javalens.scanner;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * JavaLens Standalone Java Scanner Sidecar
 * Scans Maven/Gradle multi-module projects, parses Java files, extracts classes, interfaces,
 * annotations (Spring, Jakarta), dependencies and produces JSON to stdout.
 */
public class JavaScannerMain {

    private static final Pattern PKG_PATTERN = Pattern.compile("package\\s+([a-zA-Z0-9_.]+)\\s*;");
    private static final Pattern CLASS_PATTERN = Pattern.compile(
        "(?:public|protected|private|static|final|abstract|\\s)*\\b(class|interface|enum|record|@interface)\\s+([a-zA-Z0-9_]+)(?:<[^>]+>)?(?:\\s+extends\\s+([a-zA-Z0-9_., <>]+))?(?:\\s+implements\\s+([a-zA-Z0-9_., <>]+))?"
    );
    private static final Pattern FIELD_PATTERN = Pattern.compile(
        "^\\s*(?:@([a-zA-Z0-9_]+)\\s+)*(?:private|protected|public)?\\s*(?:final\\s+|static\\s+)*([a-zA-Z0-9_]+)(?:<[^>]+>)?\\s+([a-zA-Z0-9_]+)\\s*(?:=.*)?;",
        Pattern.MULTILINE
    );
    private static final Pattern ANNOTATION_PATTERN = Pattern.compile("@([a-zA-Z0-9_]+)");

    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("Usage: java -jar java-scanner.jar <project_path>");
            System.exit(1);
        }

        String projectPath = args[0];
        File rootDir = new File(projectPath);
        if (!rootDir.exists() || !rootDir.isDirectory()) {
            System.err.println("Error: Directory does not exist: " + projectPath);
            System.exit(1);
        }

        long startTime = System.currentTimeMillis();
        try {
            String jsonOutput = scanProjectToJson(rootDir, startTime);
            System.out.println(jsonOutput);
        } catch (Exception e) {
            System.err.println("Scan error: " + e.getMessage());
            e.printStackTrace(System.err);
            System.exit(2);
        }
    }

    public static String scanProjectToJson(File rootDir, long startTime) throws IOException {
        String projectName = rootDir.getName();
        List<Map<String, Object>> modules = new ArrayList<>();
        List<Map<String, Object>> packages = new ArrayList<>();
        List<Map<String, Object>> classes = new ArrayList<>();
        List<Map<String, Object>> relationships = new ArrayList<>();

        // Detect modules
        File pomFile = new File(rootDir, "pom.xml");
        File gradleSettings = new File(rootDir, "settings.gradle");

        if (pomFile.exists()) {
            String pomContent = Files.readString(pomFile.toPath());
            Matcher m = Pattern.compile("<module>([^<]+)</module>").matcher(pomContent);
            while (m.find()) {
                String modName = m.group(1).trim();
                Map<String, Object> mod = new HashMap<>();
                mod.put("id", modName);
                mod.put("name", modName);
                mod.put("path", new File(rootDir, modName).getAbsolutePath());
                mod.put("build_type", "maven");
                mod.put("direct_dependencies", new ArrayList<>());
                mod.put("exported_packages", new ArrayList<>());
                mod.put("afferent_coupling", 0);
                mod.put("efferent_coupling", 0);
                mod.put("instability", 0.0);
                modules.add(mod);
            }
        }

        if (modules.isEmpty()) {
            Map<String, Object> mod = new HashMap<>();
            mod.put("id", projectName);
            mod.put("name", projectName);
            mod.put("path", rootDir.getAbsolutePath());
            mod.put("build_type", pomFile.exists() ? "maven" : "standard");
            mod.put("direct_dependencies", new ArrayList<>());
            mod.put("exported_packages", new ArrayList<>());
            mod.put("afferent_coupling", 0);
            mod.put("efferent_coupling", 0);
            mod.put("instability", 0.0);
            modules.add(mod);
        }

        Map<String, Set<String>> packageClasses = new HashMap<>();
        Map<String, String> classToPackage = new HashMap<>();
        Map<String, String> classToModule = new HashMap<>();
        Map<String, List<String>> classesBySimpleName = new HashMap<>();

        // Scan java files
        List<Path> javaFiles;
        try (var stream = Files.walk(rootDir.toPath())) {
            javaFiles = stream.filter(p -> p.toString().endsWith(".java")).collect(Collectors.toList());
        }

        for (Path javaFile : javaFiles) {
            String content = Files.readString(javaFile);
            List<String> lines = Files.readAllLines(javaFile);
            int loc = lines.size();

            String pkgName = "default";
            Matcher pkgMatcher = PKG_PATTERN.matcher(content);
            if (pkgMatcher.find()) {
                pkgName = pkgMatcher.group(1).trim();
            }

            String modName = modules.get(0).get("name").toString();
            for (Map<String, Object> m : modules) {
                String modPath = m.get("path").toString();
                if (javaFile.toAbsolutePath().startsWith(Paths.get(modPath))) {
                    modName = m.get("name").toString();
                    break;
                }
            }

            List<String> annotations = new ArrayList<>();
            Matcher annMatcher = ANNOTATION_PATTERN.matcher(content);
            while (annMatcher.find()) {
                String ann = annMatcher.group(1);
                if (List.of("Service", "Component", "Repository", "Controller", "RestController", "Entity", "Configuration", "Bean").contains(ann)) {
                    if (!annotations.contains(ann)) {
                        annotations.add(ann);
                    }
                }
            }

            Matcher classMatcher = CLASS_PATTERN.matcher(content);
            while (classMatcher.find()) {
                String kindStr = classMatcher.group(1);
                String simpleName = classMatcher.group(2);
                String superCls = classMatcher.group(3) != null ? classMatcher.group(3).split("<")[0].trim() : null;
                String ifacesRaw = classMatcher.group(4);

                List<String> interfaces = new ArrayList<>();
                if (ifacesRaw != null) {
                    for (String iface : ifacesRaw.split(",")) {
                        String clean = iface.split("<")[0].trim();
                        if (!clean.isEmpty()) interfaces.add(clean);
                    }
                }

                String kind = "Class";
                if ("interface".equals(kindStr)) kind = "Interface";
                else if ("enum".equals(kindStr)) kind = "Enum";
                else if ("record".equals(kindStr)) kind = "Record";
                else if ("@interface".equals(kindStr)) kind = "Annotation";
                else if (content.contains("abstract class " + simpleName)) kind = "AbstractClass";

                List<Map<String, Object>> fields = new ArrayList<>();
                Matcher fieldMatcher = FIELD_PATTERN.matcher(content);
                while (fieldMatcher.find()) {
                    String fAnn = fieldMatcher.group(1);
                    String fType = fieldMatcher.group(2);
                    String fName = fieldMatcher.group(3);
                    Map<String, Object> field = new HashMap<>();
                    field.put("name", fName);
                    field.put("type_name", fType);
                    field.put("is_injected", "Autowired".equals(fAnn) || "Inject".equals(fAnn));
                    field.put("annotations", fAnn != null ? List.of(fAnn) : List.of());
                    fields.add(field);
                }

                String fqcn = pkgName.equals("default") ? simpleName : pkgName + "." + simpleName;

                Map<String, Object> cls = new HashMap<>();
                cls.put("id", fqcn);
                cls.put("name", simpleName);
                cls.put("package_name", pkgName);
                cls.put("module_name", modName);
                cls.put("file_path", javaFile.toAbsolutePath().toString());
                cls.put("line_number", 1);
                cls.put("kind", kind);
                cls.put("is_public", content.contains("public class " + simpleName) || content.contains("public interface " + simpleName));
                cls.put("loc", loc);
                cls.put("super_class", superCls);
                cls.put("interfaces", interfaces);
                cls.put("annotations", annotations);
                cls.put("fields", fields);
                cls.put("methods", new ArrayList<>());
                cls.put("referenced_types", new ArrayList<>());
                classes.add(cls);

                packageClasses.computeIfAbsent(pkgName, k -> new HashSet<>()).add(fqcn);
                classToPackage.put(fqcn, pkgName);
                classToModule.put(fqcn, modName);
                classesBySimpleName.computeIfAbsent(simpleName, k -> new ArrayList<>()).add(fqcn);
            }
        }

        // Build packages
        for (Map.Entry<String, Set<String>> entry : packageClasses.entrySet()) {
            Map<String, Object> pkg = new HashMap<>();
            pkg.put("id", entry.getKey());
            pkg.put("name", entry.getKey());
            pkg.put("module_name", modules.get(0).get("name"));
            pkg.put("class_ids", new ArrayList<>(entry.getValue()));
            pkg.put("subpackage_ids", new ArrayList<>());
            pkg.put("metrics", null);
            packages.add(pkg);
        }

        // Build relationships
        int relId = 1;
        Set<String> classIdsSet = classes.stream().map(c -> c.get("id").toString()).collect(Collectors.toSet());

        for (Map<String, Object> c : classes) {
            String srcId = c.get("id").toString();

            // Extends
            if (c.get("super_class") != null) {
                String sup = c.get("super_class").toString();
                for (String tgtId : resolveType(sup, c.get("package_name").toString(), classesBySimpleName, classIdsSet)) {
                    if (!tgtId.equals(srcId)) {
                        Map<String, Object> rel = new HashMap<>();
                        rel.put("id", "rel-" + (relId++));
                        rel.put("source", srcId);
                        rel.put("target", tgtId);
                        rel.put("kind", "Extends");
                        rel.put("description", "extends");
                        rel.put("is_circular", false);
                        relationships.add(rel);
                    }
                }
            }

            // Implements
            @SuppressWarnings("unchecked")
            List<String> ifaces = (List<String>) c.get("interfaces");
            for (String iface : ifaces) {
                for (String tgtId : resolveType(iface, c.get("package_name").toString(), classesBySimpleName, classIdsSet)) {
                    if (!tgtId.equals(srcId)) {
                        Map<String, Object> rel = new HashMap<>();
                        rel.put("id", "rel-" + (relId++));
                        rel.put("source", srcId);
                        rel.put("target", tgtId);
                        rel.put("kind", "Implements");
                        rel.put("description", "implements");
                        rel.put("is_circular", false);
                        relationships.add(rel);
                    }
                }
            }

            // Fields
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> flds = (List<Map<String, Object>>) c.get("fields");
            for (Map<String, Object> fld : flds) {
                String fType = fld.get("type_name").toString();
                for (String tgtId : resolveType(fType, c.get("package_name").toString(), classesBySimpleName, classIdsSet)) {
                    if (!tgtId.equals(srcId)) {
                        Map<String, Object> rel = new HashMap<>();
                        rel.put("id", "rel-" + (relId++));
                        rel.put("source", srcId);
                        rel.put("target", tgtId);
                        rel.put("kind", "FieldDependency");
                        rel.put("description", (Boolean) fld.get("is_injected") ? "@Autowired" : "field");
                        rel.put("is_circular", false);
                        relationships.add(rel);
                    }
                }
            }
        }

        // Package relationships
        Set<String> seenPkgRels = new HashSet<>();
        for (Map<String, Object> rel : new ArrayList<>(relationships)) {
            String srcPkg = classToPackage.get(rel.get("source").toString());
            String tgtPkg = classToPackage.get(rel.get("target").toString());
            if (srcPkg != null && tgtPkg != null && !srcPkg.equals(tgtPkg)) {
                String pair = srcPkg + "->" + tgtPkg;
                if (seenPkgRels.add(pair)) {
                    Map<String, Object> pkgRel = new HashMap<>();
                    pkgRel.put("id", "rel-pkg-" + (relId++));
                    pkgRel.put("source", srcPkg);
                    pkgRel.put("target", tgtPkg);
                    pkgRel.put("kind", "PackageDependency");
                    pkgRel.put("description", "package dependency");
                    pkgRel.put("is_circular", false);
                    relationships.add(pkgRel);
                }
            }
        }

        long scanTime = System.currentTimeMillis() - startTime;

        // Construct final JSON manually without external dependencies for maximum compatibility
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"project_name\":").append(toJsonStr(projectName)).append(",");
        sb.append("\"root_path\":").append(toJsonStr(rootDir.getAbsolutePath())).append(",");
        sb.append("\"scan_time_ms\":").append(scanTime).append(",");
        sb.append("\"modules\":").append(toJsonList(modules)).append(",");
        sb.append("\"packages\":").append(toJsonList(packages)).append(",");
        sb.append("\"classes\":").append(toJsonList(classes)).append(",");
        sb.append("\"relationships\":").append(toJsonList(relationships));
        sb.append("}");

        return sb.toString();
    }

    private static List<String> resolveType(String typeName, String currentPkg, Map<String, List<String>> bySimple, Set<String> allIds) {
        String clean = typeName.split("<")[0].trim();
        if (allIds.contains(clean)) return List.of(clean);
        String samePkg = currentPkg + "." + clean;
        if (allIds.contains(samePkg)) return List.of(samePkg);
        if (bySimple.containsKey(clean)) return bySimple.get(clean);
        return List.of();
    }

    private static String toJsonStr(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "") + "\"";
    }

    @SuppressWarnings("unchecked")
    private static String toJsonObj(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append(toJsonStr(entry.getKey())).append(":");
            Object val = entry.getValue();
            if (val == null) {
                sb.append("null");
            } else if (val instanceof String) {
                sb.append(toJsonStr((String) val));
            } else if (val instanceof Number || val instanceof Boolean) {
                sb.append(val);
            } else if (val instanceof List) {
                sb.append(toJsonList((List<?>) val));
            } else if (val instanceof Map) {
                sb.append(toJsonObj((Map<String, Object>) val));
            } else {
                sb.append(toJsonStr(val.toString()));
            }
        }
        sb.append("}");
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private static String toJsonList(List<?> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            Object item = list.get(i);
            if (item == null) {
                sb.append("null");
            } else if (item instanceof String) {
                sb.append(toJsonStr((String) item));
            } else if (item instanceof Number || item instanceof Boolean) {
                sb.append(item);
            } else if (item instanceof Map) {
                sb.append(toJsonObj((Map<String, Object>) item));
            } else if (item instanceof List) {
                sb.append(toJsonList((List<?>) item));
            } else {
                sb.append(toJsonStr(item.toString()));
            }
        }
        sb.append("]");
        return sb.toString();
    }
}
