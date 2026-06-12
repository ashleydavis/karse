# Todo

- The status page for the cluster should include very basic performance metrics.
- I navigated to the cluster performance page and it gives this error for a real cluster:
```
Could not load data
invalid CPU quantity: 398u
```
- There's too much information in the Provisioning section of the Performance tab of the Node detail page. This needs its own subtab under Performance. It needs to be searchable, sortable and filtererable. For filtering reuse the "Pod filter" from the Logs page.
- In the treemap in the Node Performance tab (and probably other uses of the treemap) hovering brings up a wide and short white box that is empty except for a small gray square on the left hand side. What this for? Seems useless. Is it supposed to contain some useful information?
- From the Node Performance treemap I clicked down into a pod. When I clicked the back button that is on the left of the podname it took me back to the Pods page! These back buttons need to back parent page, in this case the Performance page. The path in the breadcrumb trail looked right but you must not be using that to know where to return when the back back button is clicked.

## Later

- Be great to implement an on disk cache of the cluster state.
    - As we get data with `kubectl` store it locally as JSON files.
    - Stamp the saved data with the current date.
    - When it's too far out of date (this should be configurable in a config page in the UI) we use `kubectl` get updated data.
    - Clicking the refresh button on the navbar empties the local cache.


