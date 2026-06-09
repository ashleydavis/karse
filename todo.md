# Todo

- When starting it locally start on a random port so we can have mulitple instance running in parallel.
- There should be a timeout on loading. Don't just load and show the progress spinner forever.  Timeout quickly and show an error. On error, display a note to the user to say "Make sure your internet or VPN is connected".
- I need to be able to filter nodes, pods and any other resources by label. 
    - So I need a drop down label filter that allows me to pick which labels are used to select resources for display. 
    - Picking a label should allow me to pick from a list of values for it. 
    - It will need a button to deselect all filters.
    - By default all resources should be displayed until we start selecting which ones to display by label.
- There needs to be expanded search criter in the search input for each table:
    - Search by label just by typing label name value pairs in the search input for each table.
    - Search for the node or namespace that contains the resource.
- Labels for each type of resource (nodes, pods and so on) need their own tab and have a proper table that is searchable and sortable.
- Row heights in tables for pods, nodes and all resources that labels go completely off screen for a single row because in a real cluster there are so many labels. We need to do one of the following in order of preferred priority:
    1. Truncate labels and show a "..." the user can click to see all of them in a modal. The modal would be have to be searchable to be useful.
    2. Just don't show labels in the table. They can already been seen by drilling down into each resource.
- I need a dropdown filter on the events page/table. It should allow the user to select which types of events are to be displayed. It should have a deselect all button. By default all events will be displayed until we start checking off the individual types to be displayed.
- I need a dropdown filter on the errors page/table. It should allow the user to select which types of errors are to be displayed. It should have a deselect all button. By default all errors will be displayed until we start checking off the individual types to be displayed.
- The Errors nav link should not be at the bottom of the left side bar where it can hardly be seen. It's pretty important and should move to the top.
- When searching in the errors page/table I should be able to search across any of the text that is displayed in the table. Please make sure this works.
- The cluster page need stats for the number of errors. Can we tell the number of errors currently live? If so display that. Otherwise we might have to find another way to calculate the number of errors that are currently considered active.
- In the Nodes page/table I can sees a stat saying the number of health nodes and the number in error. Can we add a filter that allows me to see just the ones in error or just the ones that are healthy? It should have checks boxes on which to show. It should have a deselect all button. By default all nodes are displayed, and when start checking boxes in the filter only those ones are displayed.
    - I need the same things pods  and other resources that have Healthy/Error stats at the top of the page/table.
- The search field in the Deployments page/table doesn't seem to do anything. Make sure this and other search fields all demonstrably work.
- On the Logs page streaming logs from all pods isn't feasible. We have to make the user pick which pods to stream by wildcard instead of just letting them stream all (when no pod is selected and no wildcard is selected). If they click the stream button without specifying pods, give them a message to say they need to pick first and tell them how to do it. 
- The Pod dropdown in the Logs page doesn't work very well when there's many pods. It would be better to have a proper drop down pod picker that allows us to search for a pod to get logs for. Once started we need to make the logs are live and continuously updated automatically.
- When many pods are streaming the labels above the logs that shows the names of the pods takes up considerable space. We need to cap this at a certain amount and show a "..." at the end the user can click to see the whole list. 
- On the Logs page I need to be sure that as new logs are streaming they are updated into Logs page. If the Logs text box is scrolled to the end when new ones come in, it should remain scrolled to the end as new logs are added to the end.
- On the Logs page it would be good see some text at the top (next to the stream button) that tells us when the last logs were added to this page.
- I'd now like to be able to drilldown into a container from the containers tab under the pod detail page. The container detail page should have status, logs, commands, yaml and anything else useful related to containers.
- Please don't say "Waiting for logs" or "Loading" anywhere. A progress indicator should be used instead.
- The copy button in the Yaml text of the yaml tab overlaps with the vertical scrollbar (when the scrollbar is visible). It shouldn't overlap.
- Is pod phase different to pod status? If I want to filter by status as well as phase. If not can we standardize on "Status" as the name of this thing and replace "Phase" everywhere we find it.
- When the breadcrumb tails in the nav bar gets too long it wraps around and makes nav bar too tall. Can we truncate the nav bar so that it displays more than 3 or 4 items (you can replace inner items with "..."). You can experiment to find out which of 3 or 4 works best.
    - It would be good also truncate long resources names in the breadcrumb trail. If the are longer than a certain amount (you can decide) the middle should be chopped out and replaced with "...".
- Go through the roadmap and remove items there that are now fully implemented. Leave items that have not been started or not fully implemented.

## Later

- Be great to implement an on disk cache of the cluster state.
    - As we get data with `kubectl` store it locally as JSON files.
    - Stamp the saved data with the current date.
    - When it's too far out of date (this should be configurable in a config page in the UI) we use `kubectl` get updated data.
    - Clicking the refresh button on the navbar empties the local cache.


