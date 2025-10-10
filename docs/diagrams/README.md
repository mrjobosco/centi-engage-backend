# Architecture Diagrams

This directory contains Mermaid diagram source files (.mmd) and their generated SVG outputs.

## Diagram Types

### System Architecture
- `system-overview.mmd` - High-level system architecture
- `module-relationships.mmd` - Inter-module dependencies
- `data-flow.mmd` - Data flow across the system

### Authentication Flow
- `jwt-auth-flow.mmd` - JWT authentication sequence
- `oauth-flow.mmd` - Google OAuth integration flow
- `permission-check.mmd` - Permission validation process

### Notification System
- `notification-architecture.mmd` - Notification system components
- `notification-flow.mmd` - Notification delivery process
- `queue-processing.mmd` - Background job processing

### Database Design
- `entity-relationships.mmd` - Database entity relationships
- `tenant-isolation.mmd` - Multi-tenant data isolation

## Generating Diagrams

To generate SVG files from Mermaid source:

```bash
npm run docs:diagrams
```

To build complete documentation with diagrams:

```bash
npm run docs:full
```

## Mermaid Syntax Reference

- [Mermaid Documentation](https://mermaid-js.github.io/mermaid/)
- [Flowchart Syntax](https://mermaid-js.github.io/mermaid/#/flowchart)
- [Sequence Diagram Syntax](https://mermaid-js.github.io/mermaid/#/sequenceDiagram)
- [Entity Relationship Diagram](https://mermaid-js.github.io/mermaid/#/entityRelationshipDiagram)