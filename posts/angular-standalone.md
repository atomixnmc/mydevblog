# Angular Standalone Components: The End of NgModules

Angular's standalone components, stable since v14 and the default in v16+, represent the biggest simplification of the developer experience since Angular 2 itself. The premise is radical for Angular: eliminate NgModules entirely. After a decade of telling developers that NgModules were essential for organizing Angular applications, the framework team decided they were optional—and then decided they were no longer the default.

## The NgModule Complexity Tax

**Before standalone**: Every component, directive, or pipe had to be declared in exactly one NgModule. That module had to import other modules to access their components. A simple button component required a `SharedModule` import chain that grew as the application scaled. The NgModule graph mirrored the component tree but with different edges, creating confusion about where to declare vs. import vs. export.

```typescript
// The old way: NgModules everywhere
// button.component.ts
@Component({
  selector: 'app-button',
  template: `<button>{{label}}</button>`
})
export class ButtonComponent { label = 'Click'; }

// button.module.ts
@NgModule({
  declarations: [ButtonComponent],
  exports: [ButtonComponent]
})
export class ButtonModule {}

// shared.module.ts
@NgModule({
  imports: [ButtonModule],
  exports: [ButtonModule]
})
export class SharedModule {}

// feature.module.ts
@NgModule({
  imports: [SharedModule, CommonModule],
  declarations: [FeatureComponent],
  exports: [FeatureComponent]
})
export class FeatureModule {}

// app.module.ts
@NgModule({
  imports: [FeatureModule, BrowserModule],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

Every time you created a component, you had to: create a module for it (or find an existing one), declare it in that module, export it from that module if other modules needed it, import that module in the parent module, and verify the import chain didn't create a circular dependency. This boilerplate existed for every component, even the trivial ones.

I worked on an enterprise Angular app where the NgModule graph had grown to 50+ modules. The module dependency diagram looked like a plate of spaghetti. Circular dependencies were common. Teams would accidentally create two modules that depended on each other, requiring complex refactoring to extract a shared module. The `providedIn: 'root'` pattern for services reduced some of this pain, but components and directives still needed module declarations.

The core problem was that NgModules served multiple purposes: they declared which components belonged together, provided dependency injection scopes, controlled lazy loading boundaries, and configured the compiler. A single construct trying to do all these things inevitably caused confusion.

## The Standalone Component Pattern

**After standalone**: Components state their dependencies directly in the `@Component` decorator: `imports: [CommonModule, FormsModule, MyButtonComponent]`. No module wrapper needed.

```typescript
// Standalone component - no NgModule required
@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, UserAvatarComponent, UserStatsComponent],
  template: `
    <div class="profile">
      <app-user-avatar [user]="user"></app-user-avatar>
      <app-user-stats [user]="user"></app-user-stats>
    </div>
  `
})
export class UserProfileComponent {
  @Input() user!: User;
}
```

The `standalone: true` flag tells the Angular compiler that this component doesn't need an NgModule wrapper. Its dependencies are declared directly in the `imports` array. The compiler has all the information it needs to compile the template—it knows where to find `UserAvatarComponent` and `UserStatsComponent`.

The component is bootstrapped with `bootstrapApplication(AppComponent, { providers: [...] })`:

```typescript
// main.ts - no AppModule needed
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(HttpClientModule),
    { provide: ErrorHandler, useClass: AppErrorHandler }
  ]
});
```

The `bootstrapApplication` function replaces `platformBrowserDynamic().bootstrapModule(AppModule)`. Providers that were previously configured in `AppModule.providers` now go in the `providers` array passed to `bootstrapApplication`. Lazy-loaded routes use `loadComponent` instead of `loadChildren`:

```typescript
// Lazy loading with standalone components
const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.component').then(c => c.AdminComponent)
  },
  {
    path: 'users',
    loadChildren: () => import('./users/routes').then(r => r.userRoutes)
  }
];
```

No `loadChildren` pointing to NgModules. `loadComponent` directly lazy-loads a standalone component. Angular handles the chunking and loading automatically.

## The Mental Model Shift

The mental model simplifies dramatically. A standalone component owns its dependency graph. The compiler has all the information it needs from the decorator alone—no module resolution phase required. Tree-shaking improves because unused components are never referenced, even indirectly.

In the NgModule world, the mental model was: "I need to find or create a module, declare my component in it, and make sure the export chain allows other modules to use it." In the standalone world, the mental model is: "My component needs these dependencies. I import them directly. Done."

This shift eliminates several categories of Angular bugs:

- **The "component is not declared in any module" error.** Common when creating a new component and forgetting to add it to a module. With standalone, the component is self-contained—no module declaration needed.

- **The "component is declared in two modules" error.** Common in large codebases where teams accidentally added a component to multiple modules. Standalone components can't be declared in modules, so this error disappears.

- **Circular module dependencies.** A design issue where Module A imports Module B, which imports Module A. With standalone components, the dependency graph is the component tree, not the module graph, making circular dependencies much less likely.

```typescript
// Standalone: dependencies are explicit and local
@Component({
  standalone: true,
  imports: [AComponent, BComponent], // Only what this component needs
  template: `...`
})
export class MyComponent {}
```

## Migration Path

`ng generate @angular/core:standalone` runs a schematic that converts existing NgModules to standalone components incrementally. The schematic does the following:

1. **Adds `standalone: true`** to every component, directive, and pipe
2. **Converts declarations to imports** in the NgModule that declared them
3. **Creates a compatibility layer** so standalone components can still be used in NgModule-based apps
4. **Optionally removes the NgModule** if it's no longer needed

The migration is intentionally incremental. Components can mix standalone and module-based dependencies—a standalone component can still import a `SharedModule` during transition:

```typescript
// Mixing standalone and module-based dependencies
@Component({
  standalone: true,
  imports: [
    CommonModule,         // Module
    FormsModule,          // Module
    MyButtonComponent,    // Standalone component
    MyPipe                // Standalone pipe
  ],
  template: `...`
})
export class HybridComponent {}
```

The Angular team recommends migrating feature-by-feature rather than all at once. I followed this approach on a project with 150+ components. We started with leaf components (the most nested, no dependencies on other components) and worked our way up. Each migration took ~10 minutes per component. The hardest part was converting services that relied on `Module.forRoot()` patterns, which needed replacement with `provideXxx()` functions.

## Providers: The One Thing That Remains

Providers still exist. Dependency injection providers don't go away—they move to `bootstrapApplication`'s provider array and route-level providers for lazy-loaded scopes:

```typescript
// Application-level providers
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes, withViewTransitions()),
    provideAnimations(),
    importProvidersFrom(SomeLegacyModule)
  ]
});

// Route-level providers
const routes: Routes = [{
  path: 'admin',
  loadComponent: () => import('./admin/admin.component'),
  providers: [
    AdminService,
    { provide: ADMIN_CONFIG, useValue: config }
  ]
}];
```

The `providers` array on `@Component` provides component-scoped injection. This replaces the old pattern of creating a feature module just to scope providers:

```typescript
@Component({
  standalone: true,
  providers: [FeatureScopedService],
  template: `...`
})
export class FeatureComponent {
  // FeatureScopedService is available to this component and its children
  // but NOT to sibling components
  constructor(private service: FeatureScopedService) {}
}
```

The mental model changes from "module-scoped providers" to "environment-scoped providers" aligned with the component tree. This is actually closer to how dependency injection works in other frameworks (React's context providers, for example) and is more intuitive for new Angular developers.

The `importProvidersFrom` function bridges legacy NgModules into the standalone world. If a library only provides an NgModule-based API (like some older Angular libraries), `importProvidersFrom(ModuleName)` extracts its providers and makes them available in the standalone environment.

## What Standalone Components Enable

Beyond reducing boilerplate, standalone components enable patterns that were awkward or impossible with NgModules:

**Direct component imports.** You can import a component directly without going through its module. This simplifies tree-shaking because the bundler can trace the exact dependency graph:

```typescript
import { UserCardComponent } from './user-card.component';

@Component({
  standalone: true,
  imports: [UserCardComponent], // Direct component import
  template: `<app-user-card [user]="user"></app-user-card>`
})
export class UserListComponent {}
```

**Functional guards and resolvers.** Without NgModules, guards and resolvers can be plain functions instead of injectable classes:

```typescript
// Functional guard - no class, no NgModule
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() || inject(Router).navigate(['/login']);
};

const routes: Routes = [{
  path: 'profile',
  loadComponent: () => import('./profile.component'),
  canActivate: [authGuard]
}];
```

**Lazy loading without feature modules.** Feature modules were often created solely as lazy loading boundaries. With standalone components, lazy loading is a routing concern, not a module concern.

## Conclusion

Standalone components don't make Angular fundamentally different—the runtime is nearly identical. But they transform developer ergonomics, reducing boilerplate and aligning the module system with how developers naturally think about component dependencies. After years of NgModules, the standalone approach feels like coming up for air. The framework is still Angular—still powerful, still opinionated—but now with significantly less ceremony.
