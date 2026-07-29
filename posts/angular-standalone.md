# Angular Standalone Components: The End of NgModules

Angular's standalone components, stable since v14 and the default in v16+, represent the biggest simplification of the developer experience since Angular 2 itself. The premise is radical for Angular: eliminate NgModules entirely.

**Before standalone**: Every component, directive, or pipe had to be declared in exactly one NgModule. That module had to import other modules to access their components. A simple button component required a `SharedModule` import chain that grew as the application scaled. The NgModule graph mirrored the component tree but with different edges, creating confusion about where to declare vs. import vs. export.

**After standalone**: Components state their dependencies directly in the `@Component` decorator: `imports: [CommonModule, FormsModule, MyButtonComponent]`. No module wrapper needed. The component is bootstrapped with `bootstrapApplication(AppComponent, { providers: [...] })`. Route configuration uses `loadComponent` instead of `loadChildren`, lazily loading components directly rather than through module paths.

**The mental model** simplifies dramatically. A standalone component owns its dependency graph. The compiler has all the information it needs from the decorator alone—no module resolution phase required. Tree-shaking improves because unused components are never referenced, even indirectly. Lazy loading becomes straightforward: `loadComponent: () => import('./admin.component').then(c => c.AdminComponent)`.

**Migration path**: `ng generate @angular/core:standalone` runs a schematic that converts existing NgModules to standalone components incrementally. Components can mix standalone and module-based dependencies—a standalone component can still import a `SharedModule` during transition. The Angular team recommends migrating feature-by-feature rather than all at once.

**Providers still exist**: Dependency injection providers don't go away—they move to `bootstrapApplication`'s provider array and route-level providers for lazy-loaded scopes. The `providers` array on `@Component` provides component-scoped injection. The mental model changes from "module-scoped providers" to "environment-scoped providers" aligned with the component tree.

Standalone components don't make Angular fundamentally different—the runtime is nearly identical. But they transform developer ergonomics, reducing boilerplate and aligning the module system with how developers naturally think about component dependencies.
