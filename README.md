# SPARQL Query Execution in Networks of Web Browsers

Snob is a SPARQL query execution model over data hosted in a network of browsers

# Install

```
git clone --recurse-submodules https://github.com/chaconinc/MainProject
// or git clone https://github.com/folkvir/webrtc-dequenpeda.git
// git submodule init
// git submodule update
cd webrtc-dequenpeda
npm install
```

# Create your web-app with the client
```
# from root folder
npm run build
# now check in dist/ folder
```

# Results

## Average completeness by round

Average query completeness by round for different queries number with RPS, RPS+SON network configuration. Left to right respectively 49 (quarter), 98 (half) and 196 (all) queries.

![](tests/saved-results/completeness.png)

## Average number of messages by round

Average query completeness by round for different queries number with RPS, RPS+SON network configuration. Left to right respectively 49 (quarter), 98 (half) and 196 (all) queries.

![](tests/saved-results/messages.png)
