# Todo

## Automated

- Searches should be reflected in the URL so they are shareable.
    - When drilling down to a detail page then hitting the back button, it doesn't go back to the search. Hitting the back button should restore the search.
- Clicking on HorizontalPodAutoscaler in the resource list doesn't go to resource detail page!
    - Every resource should have a detail page. 
    - Generic resources should have a generic detail page.
    - Resources that already have a specific detail page (e.g. pods, deployments, etc) should use their existing detail page instead of the generic one.
    - HorizontalPodAutoscaler should have custom detail page that shows the details of the hpa.

## Me

- Check the performance metrics and make sure they are good.

## Later

- Be great to organize clusters (contexts) by environment. So we can quickly see prod vs dev vs stg.
- Be great to get a total overview.
    - How many clusters do we have?
    - How many nodes in total?
    - Performance over all clusters.
- Be great to get an overview by environment.
    - How many clusters?
    - How many nodes?
    - Performance for an whole env.
