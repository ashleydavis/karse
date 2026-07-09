# Todo

## Automated

- Typing in the pod search field is very slow. I think it's trying to execute the search as I type. This might just need to be debounced.
    - Also the search field might not actually be working. Please check that it actually filters pods, deployments, nodes, etc.
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
- Errors and events and in tables and their detail pages should link to the detail pages for the resources they are related to.
- Need context sensitive help. 
    - What was the source of the information for each page?
    - How does the user run the commands to get the information themselves?
- Clicking the refresh button doesn't appear to do anything.
- Be good to get HPAs in the dashboard. Want to see how they are performing. Not sure how they will fit. Do not action this until you know how they will fit.
- In the various tables (e.g. nodes table) when the labels are truncated (because there's too many), clicking the truncated button should show a modal that lists all the labels. The table of labels should sortable and searchable. Make sure its a reusable component and use it to show labels for every resources that has labels.
- I want an activity log of important events. For instance I'd like to see when the latest node was spun up. Note this might already be catered for in the events page, if so we don't need to add the activity log.
- For every resource, event, error, log, etc, that has a time associated with it, I want to be able to switch between age and local time. Current it only has age I think. Make sure the local time is formmated to be readable. There needs to be a toggle button to swtich between age and local time. This applies to the acitivt log as well if we have added that.
- It would be good to limit time based items (logs, events, errors, activity log, etc) to a particular time range. By default this should be "last 7 days", but I want to be able to choose "all time" or a variable X (1, 2, 5, 7, etc) and time period (minute, your, day, week, month). This applies to the acitivt log as well if we have added that.
- It's overwhelming seeing so many events and errors.
    - I need a way to filter them out.
    - I need to be able to categorize them so we know which ones are duplicates:
        - A hash based on the details of the event/error so we can see like errors across services.
        - A an extend hash based on the details of the event/error and the service name, so we can see like events/errors for a particular named service.
    - I want to then be able to filter out events/errors:
        - Hide all events/errors of a certain type (based on error details hash or error details + service name hash).
        - Hidden events/errors should be reflected in the event/error count.
    - The UI should show that errors/events are hidden.
    - It needs a button to reset the filter.
    - Filters should be activated by clicking a "..." button for each event/error row and then:
        - Filter out all events/errors like this one.
        - Filter out all events/errors like this one, just for this service.
        - Filter out all events/errors from this service.
    - Filters can also work the opposite way:
        - Show only events/errors like this.
        - Show only events/errors like this, just for this services.
        - Show only events/error for this service.
    - This applies to the activity log as well if we have added that.
- For every page that contains references to other resources, please add a link to the detail page for that resource. Make sure the breadcrumb trail reflects properly how we got to that detail page.
- In the "POD STATUS" read out that shows running, pending, failed and succeeded pods, each one of those should be a link that enables the filter for running, pending, failed an succeeded pods.

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