# Todo

- The current Performance tabs should be renamed "Resource Utilization" (or should they?)
- When the window is smaller than the table, the actions column goes off screen and we have to use the horizontal scrollbar to see all of it. Is there anyway to improve on this?
- Is the all resources page missing any resource kinds? I think it should be listing all resources in the cluster and just displaying them, but maybe it's querying only for particular types of resources and is therefore missing some. This needs to be checked and fix if necessary.
- The All resources page should come after Events in the left side menu.
- It would be good if "error" was highlighted in red in the log text component. And "warning" in yellow.
- When in the Logs page is say "Logs" in the navbar and in the title of the page. There's no need for the Logs page to have its title displayed twice. Remove the one in the page and keep the one in navbar. Check if other pages need this fix.
- The "Status" page should be the "Cluster" page and not called "Status" in the navbar or left side bar.
- The pod picker/filter needs to be bigger so I don't have to scroll to see all the pods when there are many and because the dropdown is too small.
- Automatic scrolling in the logs view is broken. When scrolled to the end and new logs come in and are added to the end, the text should automatically be kept pinned to the end (essentially: scroll to the end automatically as new logs are added to the end, if we were already scrolled to the end). Wierdly this seems to work for the Logs tab under the Pod detail page, but doesn't work for the global Logs pages.
- It would be good to remove pods from the logs page by clicking a close button at the end of each pod name label.