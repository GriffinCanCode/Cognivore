/**
 * TabGraph.js - Renders an interactive visualization of tab relationships
 * 
 * This component uses D3.js to create a force-directed graph visualization
 * of tabs and their relationships. Tabs are shown as nodes, with related tabs
 * connected by edges. Tabs in the same group share colors, and the graph
 * supports interactive features like zooming, dragging, and expanding/collapsing clusters.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TabGraph = ({ tabs, groups, activeTabId, onTabClick, onGroupClick }) => {
  const svgRef = useRef(null);
  const graphContainerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [hoveredNode, setHoveredNode] = useState(null);
  
  // Update dimensions when container size changes
  useEffect(() => {
    if (!graphContainerRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    
    resizeObserver.observe(graphContainerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  
  // Render graph whenever tabs, groups, or dimensions change
  useEffect(() => {
    if (!svgRef.current || tabs.length === 0 || !dimensions.width) return;
    
    renderGraph();
  }, [tabs, groups, activeTabId, dimensions, collapsedGroups, hoveredNode]);
  
  const renderGraph = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    const width = dimensions.width;
    const height = dimensions.height;
    
    // Create scale for node sizing based on importance
    const nodeScale = d3.scaleLinear()
      .domain([0, 1])
      .range([6, 18]); // Increased size range for better visibility
    
    // Prepare data for D3 visualization
    const nodesData = [];
    const linksData = [];
    
    // Process groups and determine which nodes to show
    groups.forEach(group => {
      const isCollapsed = collapsedGroups[group.id];
      
      if (isCollapsed) {
        // Add a single node for the collapsed group
        nodesData.push({
          id: `group-${group.id}`,
          type: 'group',
          label: group.name || `Group ${group.id}`,
          color: group.color || '#64748b',
          size: 24, // Larger size for group nodes
          group: group.id,
          tabIds: group.tabIds
        });
      } else {
        // Add individual nodes for tabs in this group
        group.tabIds.forEach(tabId => {
          const tab = tabs.find(t => t.id === tabId);
          if (tab) {
            nodesData.push({
              id: tab.id,
              type: 'tab',
              label: tab.title || tab.url,
              url: tab.url,
              favicon: tab.favicon,
              color: group.color || '#64748b',
              size: nodeScale(tab.importance || 0.5),
              group: group.id,
              isActive: tab.id === activeTabId,
              isHovered: hoveredNode === tab.id
            });
          }
        });
      }
    });
    
    // Create links between related tabs based on similarity
    tabs.forEach(tab => {
      if (tab.relatedTabs && !collapsedGroups[tab.groupId]) {
        tab.relatedTabs.forEach(relation => {
          // Only create links if both tabs are visible (not in collapsed groups)
          const targetTab = tabs.find(t => t.id === relation.tabId);
          if (targetTab && !collapsedGroups[targetTab.groupId]) {
            linksData.push({
              source: tab.id,
              target: relation.tabId,
              value: relation.similarity,
              strength: relation.similarity * 0.7 // Scale similarity for link strength
            });
          }
        });
      }
    });
    
    // Create D3 force simulation with improved forces
    const simulation = d3.forceSimulation(nodesData)
      .force("link", d3.forceLink(linksData)
        .id(d => d.id)
        .distance(d => 150 - (d.strength * 50)) // Dynamic link distance based on similarity
        .strength(d => d.strength || 0.3))
      .force("charge", d3.forceManyBody()
        .strength(d => d.type === 'group' ? -300 : -200)) // Stronger repulsion for group nodes
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => d.size + 12)) // Increased collision radius
      .force("x", d3.forceX(width / 2).strength(0.05)) // Keep nodes more centered
      .force("y", d3.forceY(height / 2).strength(0.05));
    
    // Create SVG elements
    const g = svg.append("g")
      .attr("class", "graph-group");
    
    // Add zoom behavior with smoother transitions
    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom)
      .call(zoom.transform, d3.zoomIdentity);
    
    // Add a subtle grid background
    const gridSize = 40;
    const grid = g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1);
    
    for (let x = 0; x < width; x += gridSize) {
      grid.append("line")
        .attr("x1", x)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", height)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1);
    }
    
    for (let y = 0; y < height; y += gridSize) {
      grid.append("line")
        .attr("x1", 0)
        .attr("y1", y)
        .attr("x2", width)
        .attr("y2", y)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1);
    }
    
    // Add a background for interactions
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("click", () => {
        // Reset hover state when clicking the background
        setHoveredNode(null);
      });
    
    // Create links with gradient effects
    const linkGroup = g.append("g")
      .attr("class", "links");
    
    // Create gradients for links
    const defs = svg.append("defs");
    
    linksData.forEach((link, i) => {
      const gradientId = `link-gradient-${i}`;
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse");
      
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d => {
          const sourceNode = nodesData.find(n => n.id === link.source);
          return sourceNode ? sourceNode.color : "#999";
        });
      
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d => {
          const targetNode = nodesData.find(n => n.id === link.target);
          return targetNode ? targetNode.color : "#999";
        });
    });
    
    const link = linkGroup.selectAll("line")
      .data(linksData)
      .enter()
      .append("line")
      .attr("stroke-width", d => Math.max(1, d.value * 4))
      .attr("stroke", (d, i) => `url(#link-gradient-${i})`)
      .attr("stroke-opacity", 0.6)
      .attr("stroke-linecap", "round");
    
    // Create node containers
    const nodeGroup = g.append("g")
      .attr("class", "nodes");
    
    const node = nodeGroup.selectAll(".node")
      .data(nodesData)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("click", handleNodeClick)
      .on("mouseover", (event, d) => {
        setHoveredNode(d.id);
      })
      .on("mouseout", () => {
        setHoveredNode(null);
      });
    
    // Add a subtle highlight/glow effect for the nodes
    node.append("circle")
      .attr("r", d => d.size + 4)
      .attr("fill", d => d.color)
      .attr("opacity", 0.2)
      .attr("class", "node-highlight");
    
    // Add circles for all nodes
    node.append("circle")
      .attr("r", d => d.size)
      .attr("fill", d => d.color)
      .attr("stroke", d => d.isActive ? "#ffffff" : (d.isHovered ? "#ffffff" : "#333"))
      .attr("stroke-width", d => d.isActive ? 3 : (d.isHovered ? 2 : 1.5))
      .attr("class", "node-circle")
      .attr("filter", d => d.isActive ? "url(#glow)" : "none");
    
    // Add glow filter
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "2.5")
      .attr("result", "coloredBlur");
    
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
      .attr("in", "coloredBlur");
    feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");
    
    // Add type-specific decorations
    node.each(function(d) {
      const currentNode = d3.select(this);
      
      // For group nodes, add a '+' or '-' symbol
      if (d.type === 'group') {
        currentNode.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("font-family", "Arial, sans-serif")
          .attr("font-weight", "bold")
          .attr("font-size", "16px")
          .attr("fill", "#fff")
          .text(collapsedGroups[d.group] ? "+" : "-");
        
        // Add a count indicator
        currentNode.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("y", d.size + 12)
          .attr("font-family", "Arial, sans-serif")
          .attr("font-size", "11px")
          .attr("fill", "#fff")
          .attr("stroke", "#000")
          .attr("stroke-width", "0.5px")
          .attr("paint-order", "stroke")
          .text(`${d.tabIds.length} tabs`);
      }
      // For tab nodes, add favicon if available
      else if (d.favicon) {
        currentNode.append("image")
          .attr("xlink:href", d.favicon)
          .attr("x", -10)
          .attr("y", -10)
          .attr("width", 20)
          .attr("height", 20)
          .attr("clip-path", "circle()");
      }
    });
    
    // Add labels with better positioning and background
    node.append("title")
      .text(d => d.label);
    
    // Add visible labels below nodes for better readability
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("y", d => d.size + 12)
      .attr("font-family", "Arial, sans-serif")
      .attr("font-size", "10px")
      .attr("fill", "#ddd")
      .attr("stroke", "#000")
      .attr("stroke-width", "0.5px")
      .attr("paint-order", "stroke")
      .text(d => {
        // Truncate long labels
        const label = d.label || "";
        return label.length > 20 ? label.substring(0, 18) + "..." : label;
      })
      .attr("opacity", d => d.isActive || d.isHovered ? 1 : 0.7)
      .attr("display", d => d.type === 'group' ? "none" : "block"); // Hide labels for group nodes
    
    // Handle node click
    function handleNodeClick(event, d) {
      event.preventDefault();
      event.stopPropagation();
      
      if (d.type === 'group') {
        setCollapsedGroups(prev => ({
          ...prev,
          [d.group]: !prev[d.group]
        }));
        
        if (onGroupClick) {
          onGroupClick(d.group);
        }
      } else {
        if (onTabClick) {
          onTabClick(d.id);
        }
      }
    }
    
    // Drag functions with improved dynamics
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      
      // Bring dragged node to front
      d3.select(this).raise();
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      // Keep node fixed for a moment after dragging ends
      setTimeout(() => {
        if (d) {
          d.fx = null;
          d.fy = null;
        }
      }, 800);
    }
    
    // Add hover effects for links
    nodeGroup.selectAll(".node")
      .on("mouseover", (event, d) => {
        // Highlight connected links and nodes
        link.attr("stroke-opacity", l => 
          l.source.id === d.id || l.target.id === d.id ? 0.8 : 0.1
        );
        link.attr("stroke-width", l => 
          l.source.id === d.id || l.target.id === d.id 
            ? Math.max(2, l.value * 5)
            : Math.max(0.5, l.value * 2)
        );
        
        // Set hovered node
        setHoveredNode(d.id);
      })
      .on("mouseout", () => {
        // Reset link appearance
        link.attr("stroke-opacity", 0.6);
        link.attr("stroke-width", d => Math.max(1, d.value * 4));
        
        // Reset hovered node
        setHoveredNode(null);
      });
    
    // Update positions on each tick with smoother transitions
    simulation.on("tick", () => {
      // Constrain nodes to container
      nodesData.forEach(d => {
        d.x = Math.max(d.size, Math.min(width - d.size, d.x));
        d.y = Math.max(d.size, Math.min(height - d.size, d.y));
      });
      
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      
      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });
  };
  
  return (
    <div className="tab-graph-container" ref={graphContainerRef} style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.3)'
    }}>
      <div className="graph-controls" style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: 10,
        display: 'flex',
        gap: '8px'
      }}>
        <button onClick={() => {
          // Reset all collapsed groups
          setCollapsedGroups({});
        }} style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer'
        }}>
          Expand All
        </button>
        <button onClick={() => {
          // Collapse all groups
          const allCollapsed = {};
          groups.forEach(g => {
            allCollapsed[g.id] = true;
          });
          setCollapsedGroups(allCollapsed);
        }} style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer'
        }}>
          Collapse All
        </button>
      </div>
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export default TabGraph; 