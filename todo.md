# Todo

- When starting it locally start on a random port so we can have mulitple instance running in parallel.
    - I don't really need this actaully.

## Later

- Be great to implement an on disk cache of the cluster state.
    - As we get data with `kubectl` store it locally as JSON files.
    - Stamp the saved data with the current date.
    - When it's too far out of date (this should be configurable in a config page in the UI) we use `kubectl` get updated data.
    - Clicking the refresh button on the navbar empties the local cache.


