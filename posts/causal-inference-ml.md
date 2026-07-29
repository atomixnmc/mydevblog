# Causal Inference in Machine Learning

Machine learning excels at pattern recognition, but correlation is not causation. A model trained to predict hospital readmission rates might learn that "ambulance siren heard" correlates with readmission, when the real causal factor is "severe underlying condition." Causal inference provides the tools to move beyond association to understanding cause and effect.

**The fundamental problem**: We can never observe both the outcome of a treatment and its counterfactual—what would have happened without it. This is the "fundamental problem of causal inference." Standard ML models trained on observational data learn spurious correlations that break under distribution shift. A model trained during a pandemic may fail catastrophically when conditions normalize.

**Directed Acyclic Graphs (DAGs)** provide the mathematical language for causal reasoning. Nodes represent variables, edges represent causal relationships. The back-door criterion tells us which variables to condition on to block spurious paths. Front-door adjustment handles unobserved confounders by using mediators. These graphical tools translate causal assumptions into statistical estimands that ML models can target.

**Double Machine Learning** (DML) is a modern framework combining causal inference with flexible ML models. DML uses Neyman-orthogonal moments to estimate causal effects even when nuisance functions (like propensity scores or outcome models) are estimated with black-box ML. The procedure: split the data, estimate nuisance functions with any ML model, then estimate causal parameters using orthogonalized residuals. This gives valid confidence intervals even with regularization bias.

**Instrumental variables** handle unobserved confounding when a valid instrument—a variable affecting treatment but not outcome except through treatment—is available. Two-stage least squares can be replaced with neural network-based IV methods, handling nonlinear causal relationships.

**Applications** include estimating treatment effects in medicine (does this drug work for this patient subgroup?), policy evaluation (did this intervention reduce crime?), and product analytics (did this feature change user behavior?). Each requires explicit causal assumptions and domain knowledge—no amount of data alone replaces understanding of the data-generating process.
