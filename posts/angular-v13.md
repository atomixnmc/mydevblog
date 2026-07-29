# Angular v13: The Ivy-Only Era Begins

Angular 13, released in November 2021, marked a watershed moment for the framework: the complete removal of the View Engine compiler. From v13 onward, Angular is Ivy-only, shedding years of backward compatibility baggage and unlocking the full performance and bundle size benefits that Ivy promised since Angular 9.

**What Ivy changed**: The old View Engine compiled templates into separate factory files linked at runtime. Ivy compiles directly into injectable instructions that can be tree-shaken. Components not imported into an application literally vanish from the production bundle. The migration to Ivy-only eliminated roughly 1,200 internal files and thousands of lines of compatibility code from the framework itself.

**Key improvements in v13**: Server-side rendering with Angular Universal now uses the Ivy compiler end-to-end, cutting SSR bundle sizes significantly. The `ng-container` and `ng-template` got better type-checking in templates. The framework also dropped support for Internet Explorer 11, removing decades of polyfill overhead and enabling modern browser APIs like native CSS Grid and CSS Variables without workarounds.

**The class inheritance and dependency injection** system became simpler. View Engine required complex metadata reflection that added indirection; Ivy's `ɵɵdefineComponent` and `ɵɵdefineNgModule` operate at the instruction level with no intermediate representation. This translated to faster AOT compilation and smaller bundles measured in double-digit percentage improvements for real applications.

**For developers migrating**, the Angular team provided automated migration schematics through `ng update`. The removal of View Engine also meant the end of legacy metadata formats like `module.id` in `@Component`, simplifying the mental model for new learners.

Angular 13 wasn't the flashiest release, but it was arguably the most important infrastructure release since Angular 2 itself. By cutting the View Engine cord, the team set the stage for the standalone components, signals, and control flow that would define Angular 14-17.
