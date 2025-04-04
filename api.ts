    // Inside the reduce function in getTagTree...

          parent.nodes.push(newNode);
          // Replace the old sort line with this block:
          parent.nodes.sort((a, b) => {
            // Define the desired order for node types
            const typeOrder = { folder: 0, tag: 1, page: 2 };
            const aType = a.data.nodeType;
            const bType = b.data.nodeType;

            // Get the order value, defaulting unknown types to the end
            const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 99;
            const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 99;

            if (aOrder !== bOrder) {
              // If types are different, sort by type order (folders/tags first)
              return aOrder - bOrder;
            } else {
              // If types are the same, sort alphabetically by title
              return a.data.title.localeCompare(b.data.title);
            }
          });
          return newNode; // Use new node as parent for next level
        }, root);
      });

      return {
        nodes: root.nodes,
      };
    }
    
