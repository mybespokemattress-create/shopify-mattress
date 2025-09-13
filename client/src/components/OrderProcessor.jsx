

import React, { useState, useEffect } from 'react';
import { Download, Mail, Edit3, Save, X, Upload, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';

const FirmnessOverrideSection = ({ 
  selectedOrder, 
  onSupplierCodeUpdate, 
  editMode 
}) => {
  const [overrideData, setOverrideData] = useState({
    needsOverride: false,
    options: [],
    mattressType: null,
    skuPrefix: null,
    loading: false
  });
  
  const [selectedOverride, setSelectedOverride] = useState('');
  const [applying, setApplying] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState(null);

  // Check override status when selectedOrder changes or when entering edit mode
  useEffect(() => {
    if (selectedOrder?.id && editMode) {
      checkOverrideStatus();
    } else {
      setOverrideData({ needsOverride: false, options: [], mattressType: null, skuPrefix: null, loading: false });
      setOverrideStatus(null);
    }
  }, [selectedOrder?.id, editMode]);

  const checkOverrideStatus = async () => {
    if (!selectedOrder?.id) return;
    
    setOverrideData(prev => ({ ...prev, loading: true }));
    
    try {

      // Get available firmness options (this will work for any mattress)
      const optionsResponse = await fetch(`/api/orders/${selectedOrder.id}/firmness-options`);
      if (!optionsResponse.ok) throw new Error('Failed to get firmness options');
      
      const optionsData = await optionsResponse.json();
      
      setOverrideData({
        needsOverride: false, // Always show as available, not required
        options: optionsData.options,
        mattressType: optionsData.mattressType,
        skuPrefix: optionsData.skuPrefix,
        loading: false
      });
      
      // Set current selection based on existing override or detect from supplier code
      const statusResponse = await fetch(`/api/orders/${selectedOrder.id}/override-status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        setOverrideStatus(status);
        
        if (status.appliedOverride) {
          setSelectedOverride(`${status.appliedOverride.depth} - ${status.appliedOverride.firmness}`);
        }
      }
      
    } catch (error) {
      console.error('Error checking override status:', error);
      setOverrideData(prev => ({ ...prev, loading: false }));
    }
  };

  const applyOverride = async () => {
    if (!selectedOverride || !overrideData.skuPrefix) return;
    
    const [depth, firmness] = selectedOverride.split(' - ');
    
    setApplying(true);
    
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}/override-firmness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depth: depth,
          firmness: firmness,
          skuPrefix: overrideData.skuPrefix
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Override failed');
      }
      
      const result = await response.json();
      
      // Update the supplier code in the parent component
      onSupplierCodeUpdate(result.newSupplierCode);
      
      // Update our local state
      setOverrideStatus(prev => ({ 
        ...prev, 
        overrideApplied: true,
        appliedOverride: { depth, firmness }
      }));
      
      alert(`Firmness override applied successfully!\nNew supplier code: ${result.newSupplierCode.substring(0, 80)}...`);
      
    } catch (error) {
      console.error('Error applying override:', error);
      alert(`Failed to apply override: ${error.message}`);
    } finally {
      setApplying(false);
    }
  };

  // Don't render if no order selected or not in edit mode
  if (!selectedOrder || !editMode) return null;

  // Loading state
  if (overrideData.loading) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          <h3 className="font-semibold text-blue-900">Loading Firmness Options...</h3>
        </div>
      </div>
    );
  }

// Debug logging
console.log('DEBUG - Order:', selectedOrder.orderNumber);
console.log('DEBUG - supplierCode:', `"${selectedOrder.supplierCode}"`);
console.log('DEBUG - supplierCode type:', typeof selectedOrder.supplierCode);
console.log('DEBUG - overrideData.options:', overrideData.options);
console.log('DEBUG - editMode:', editMode);

// Show override interface if we have options
if ((overrideData.options && overrideData.options.length > 0) || 
    (!selectedOrder.supplierCode || selectedOrder.supplierCode.trim() === '' || selectedOrder.supplierCode === '-')) {
    return (
      <div className="border rounded-lg p-4 bg-green-50 border-green-200 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          <h3 className="font-semibold text-green-900">Firmness Override Available</h3>
        </div>
        
        <div className="text-sm text-green-800 mb-3">
          Adjust firmness for <strong>{overrideData.mattressType}</strong> mattress. Current supplier code will be regenerated.
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-green-900 mb-2">
              Select Depth & Firmness:
            </label>
            <select
              value={selectedOverride}
              onChange={(e) => setSelectedOverride(e.target.value)}
              className="w-full p-3 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
            >
              <option value="">-- Select depth and firmness --</option>
              {overrideData.options.map((option) => (
                <option key={option.value} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              onClick={checkOverrideStatus}
              className="px-3 py-2 text-sm border border-green-300 rounded text-green-700 hover:bg-green-100"
            >
              Refresh Options
            </button>
            <button
              onClick={applyOverride}
              disabled={!selectedOverride || applying}
              className={`px-4 py-2 text-sm rounded text-white font-medium ${
                selectedOverride && !applying
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {applying ? 'Applying...' : 'Apply Override'}
            </button>
          </div>
          
          {overrideStatus?.appliedOverride && (
            <div className="text-xs text-green-600 mt-2">
              Last applied: {overrideStatus.appliedOverride.depth} - {overrideStatus.appliedOverride.firmness}
              {overrideStatus.overrideTimestamp && (
                <span className="ml-2">({new Date(overrideStatus.overrideTimestamp).toLocaleString()})</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

const OrderProcessor = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // New state for diagram upload
  const [uploadingDiagram, setUploadingDiagram] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [storageStatus, setStorageStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const getDiagramImageUrl = (diagramNumber) => {
    if (!diagramNumber) return null;
    return `/images/diagrams/Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`;
  };

  // Check storage status
  const checkStorageStatus = async () => {
    try {
      const response = await fetch('/api/diagrams/storage-status');
      if (response.ok) {
        const status = await response.json();
        setStorageStatus(status);
      }
    } catch (error) {
      console.error('Failed to check storage status:', error);
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size and type on frontend
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      
      if (file.size > maxSize) {
        alert('File too large. Maximum size is 5MB.');
        return;
      }
      
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Only JPG, PNG, and PDF files are allowed.');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  // Upload diagram
  const handleDiagramUpload = async () => {
    if (!selectedFile) return;
    
    setUploadingDiagram(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('diagram', selectedFile);
      
      const response = await fetch(`/api/diagrams/${selectedOrder.id}/upload-diagram`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const result = await response.json();
      
      // Update selected order with new diagram info
      setSelectedOrder(prev => ({
        ...prev,
        has_custom_diagram: true,
        custom_diagram_url: result.url,
        custom_diagram_filename: result.filename
      }));
      
      // Update orders list
      setOrders(orders.map(order => 
        order.id === selectedOrder.id 
          ? { ...order, has_custom_diagram: true, custom_diagram_url: result.url }
          : order
      ));
      
      // Update storage status
      if (result.storage) {
        setStorageStatus(result.storage);
      }
      
      setSelectedFile(null);
      alert('Diagram uploaded successfully!');
      
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploadingDiagram(false);
      setUploadProgress(0);
    }
  };

  // Remove diagram
  const handleDiagramRemove = async () => {
    if (!confirm('Are you sure you want to remove this custom diagram?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/diagrams/${selectedOrder.id}/diagram`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove diagram');
      }
      
      // Update selected order
      setSelectedOrder(prev => ({
        ...prev,
        has_custom_diagram: false,
        custom_diagram_url: null,
        custom_diagram_filename: null
      }));
      
      // Update orders list
      setOrders(orders.map(order => 
        order.id === selectedOrder.id 
          ? { ...order, has_custom_diagram: false, custom_diagram_url: null }
          : order
      ));
      
      alert('Diagram removed successfully!');
      
    } catch (error) {
      console.error('Remove error:', error);
      alert(`Failed to remove diagram: ${error.message}`);
    }
  };

  const transformApiOrder = (apiOrder) => {
    // ADD THIS DEBUG BLOCK RIGHT HERE - AT THE START OF THE FUNCTION
    console.group('🔍 Coolplus Debug - Order:', apiOrder.order_number);
    console.log('Full apiOrder object:', apiOrder);
    console.log('line_items exists?', !!apiOrder.line_items);
    console.log('line_items content:', apiOrder.line_items);
    if (apiOrder.line_items && apiOrder.line_items[0]) {
      console.log('First line item:', apiOrder.line_items[0]);
      console.log('Specification field:', apiOrder.line_items[0].specification);
      console.log('Type of specification:', typeof apiOrder.line_items[0].specification);
    }
    console.log('order_data:', apiOrder.order_data);
    console.log('order_data.supplierSpecification:', apiOrder.order_data?.supplierSpecification);
    console.groupEnd();
    // END OF DEBUG BLOCK

    const orderData = apiOrder.order_data || {};
      
    let diagramNumber = null;
    const lineItems = apiOrder.order_data?.order_data?.line_items;
    if (lineItems && lineItems[0] && lineItems[0].properties) {
      const diagramProperty = lineItems[0].properties.find(prop => prop.name === 'Diagram Number');
      diagramNumber = diagramProperty ? diagramProperty.value : null;
    }

    let linkAttachment = 'One Piece Mattress No Link Required';
    let deliveryOption = 'Rolled and Boxed';
    
    if (lineItems && lineItems[0] && lineItems[0].variant_title) {
      const variantTitle = lineItems[0].variant_title;
      const productTitle = lineItems[0].title || lineItems[0].name || '';
      
      if (variantTitle.includes('Leave Bolster Loose')) {
        linkAttachment = 'Leave Bolster Loose';
      } else if (variantTitle.includes('Leave Sections Loose')) {
        linkAttachment = 'Leave Sections Loose';
      } else if (variantTitle.includes('Fabric Link')) {
        linkAttachment = 'Fabric Link (+£40)';
      } else if (variantTitle.includes('Zip-Link')) {
        linkAttachment = 'Zip-Link (+£40)';
      } else {
        if (productTitle.toLowerCase().includes('bolster')) {
          linkAttachment = 'Leave Bolster Loose';
        } else if (productTitle.toLowerCase().includes('section')) {
          linkAttachment = 'Leave Sections Loose';
        } else {
          linkAttachment = 'One Piece Mattress No Link Required';
        }
      }
    }

    const measurements = apiOrder.order_data?.order_data?.extracted_measurements?.[0]?.measurements || {};
    
    const properties = {};
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    
    dimensions.forEach(dim => {
      // First try to get from saved database columns
      const savedDimension = apiOrder[`dimension_${dim.toLowerCase()}`];
      if (savedDimension) {
        properties[`Dimension ${dim}`] = savedDimension;
      } else {
        // Fall back to original measurements extraction
        const measurement = measurements[dim];
        if (measurement) {
          if (typeof measurement === 'object' && 'value' in measurement) {
            const displayValue = measurement.unit 
              ? `${measurement.value} ${measurement.unit}`
              : measurement.value;
            properties[`Dimension ${dim}`] = displayValue;
          } else {
            properties[`Dimension ${dim}`] = String(measurement);
          }
        } else {
          properties[`Dimension ${dim}`] = '';
        }
      }
    });

    // ADD THIS DEBUG LINE RIGHT BEFORE THE RETURN
    const finalSupplierCode = apiOrder.line_items?.[0]?.specification || orderData.supplierSpecification || '';
    console.log('📌 Final supplierCode being set:', finalSupplierCode);

    return {
      id: apiOrder.id.toString(),
      orderNumber: apiOrder.order_number || 'Unknown',
      customer: {
        name: apiOrder.customer_name || 'Unknown Customer',
        email: apiOrder.customer_email || ''
      },
      orderDate: apiOrder.created_date ? new Date(apiOrder.created_date).toISOString().split('T')[0] : '',
      status: apiOrder.processing_status === 'received' ? 'pending_review' : 'ready_to_send',
      emailSent: apiOrder.email_sent || false,
      lineItems: [{
        sku: orderData.sku || lineItems?.[0]?.sku || 'Unknown SKU',
        productTitle: lineItems?.[0]?.title || 'Unknown Product',
        quantity: 1,
        properties: properties
      }],
      supplierCode: apiOrder.supplier_code || apiOrder.line_items?.[0]?.specification || orderData.supplierSpecification || '',
      shapeNumber: orderData.shapeNumber || '',
      diagramNumber: diagramNumber,
      shapeDiagramUrl: getDiagramImageUrl(diagramNumber),
      linkAttachment: apiOrder.link_attachment || linkAttachment,
      deliveryOption: apiOrder.delivery_option || deliveryOption,
      radiusTopCorner: apiOrder.radius_top_corner || '',
      radiusBottomCorner: apiOrder.radius_bottom_corner || '',
      finishedSizeMax: apiOrder.finished_size_max || '',
      totalPrice: apiOrder.total_price,
      supplierName: apiOrder.supplier_name || orderData.supplierName,
      rawMeasurements: measurements,
      notes: apiOrder.notes || '',
      mattressLabel: apiOrder.mattress_label || 'CaravanMattresses',
      // Add custom diagram fields
      has_custom_diagram: apiOrder.has_custom_diagram || false,
      custom_diagram_url: apiOrder.custom_diagram_url || null,
      custom_diagram_filename: apiOrder.custom_diagram_url ? apiOrder.custom_diagram_url.split('/').pop() : null
    };
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/orders');
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }
      
      const apiResponse = await response.json();

      // ADD THIS DEBUG BLOCK HERE
      console.group('🌐 API Response Debug');
      console.log('Full API response:', apiResponse);
      console.log('Number of orders:', apiResponse.orders?.length);
      if (apiResponse.orders && apiResponse.orders[0]) {
        console.log('First order from API:', apiResponse.orders[0]);
        console.log('First order line_items:', apiResponse.orders[0].line_items);
      }
      console.groupEnd();
      // END OF DEBUG BLOCK

      const ordersArray = apiResponse.orders || [];
      const transformedOrders = ordersArray.map(transformApiOrder);
      setOrders(transformedOrders);
      
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    checkStorageStatus();
    const interval = setInterval(() => {
      if (!editMode) {
        fetchOrders();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [editMode]);

  const handleOrderSelect = (order) => {
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
      setEditMode(false);
    } else {
      setSelectedOrder({ ...order });
      setEditMode(false);
      setSelectedFile(null); // Clear any selected file
    }
  };

  const handleEdit = () => setEditMode(true);
  
  const handleSave = async () => {
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          processing_status: selectedOrder.status === 'ready_to_send' ? 'processed' : 'received',
          notes: selectedOrder.notes,
          mattress_label: selectedOrder.mattressLabel,
          order_number: selectedOrder.orderNumber,
          customer_name: selectedOrder.customer.name,
          customer_email: selectedOrder.customer.email,
          order_date: selectedOrder.orderDate,
          supplier_code: selectedOrder.supplierCode,
          product_sku: selectedOrder.lineItems[0]?.sku,
          quantity: selectedOrder.lineItems[0]?.quantity,
          dimension_a: selectedOrder.lineItems[0]?.properties['Dimension A'],
          dimension_b: selectedOrder.lineItems[0]?.properties['Dimension B'],
          dimension_c: selectedOrder.lineItems[0]?.properties['Dimension C'],
          dimension_d: selectedOrder.lineItems[0]?.properties['Dimension D'],
          dimension_e: selectedOrder.lineItems[0]?.properties['Dimension E'],
          dimension_f: selectedOrder.lineItems[0]?.properties['Dimension F'],
          dimension_g: selectedOrder.lineItems[0]?.properties['Dimension G'],
          radius_top_corner: selectedOrder.radiusTopCorner,
          radius_bottom_corner: selectedOrder.radiusBottomCorner,
          finished_size_max: selectedOrder.finishedSizeMax,
          link_attachment: selectedOrder.linkAttachment,
          delivery_option: selectedOrder.deliveryOption,
          measurements: selectedOrder.lineItems[0]?.properties || {}
        })
      });

      const result = await response.json();
      console.log('Save response:', result);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? selectedOrder : order
      ));
      
      setEditMode(false);
      alert('Order saved successfully!');
      
    } catch (err) {
      console.error('Error saving order:', err);
      alert(`Failed to save order: ${err.message}`);
    }
  };

  const handleCancel = () => {
    const originalOrder = orders.find(order => order.id === selectedOrder.id);
    setSelectedOrder({ ...originalOrder });
    setEditMode(false);
    setSelectedFile(null); // Clear any selected file
  };

  const updateOrderField = (field, value) => {
    setSelectedOrder(prev => ({ ...prev, [field]: value }));
  };

  const updateCustomerField = (field, value) => {
    setSelectedOrder(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: value }
    }));
  };

  const updateMeasurement = (dimension, value) => {
    setSelectedOrder(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => ({
        ...item,
        properties: { ...item.properties, [dimension]: value }
      }))
    }));
  };

  const updateAdditionalField = (field, value) => {
    setSelectedOrder(prev => ({ ...prev, [field]: value }));
  };

  const generatePDF = async () => {
    try {
      console.log('Generating PDF for order:', selectedOrder.orderNumber);
      
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: selectedOrder
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Order_${selectedOrder.orderNumber}_${selectedOrder.customer.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF');
    }
  };

  const getSupplierEmail = (supplierName) => {
    const supplierEmails = {
      'Southern Production': 'mbm@southernfoam.co.uk',
      'Mattressshire Production': 'mattressshire.wmltd@gmail.com'
    };
    
    return supplierEmails[supplierName] || 'angelo@mybespokemattress.com';
  };

  const openZohoMail = () => {
    console.log('Supplier name:', selectedOrder.supplierName);
    const supplierEmail = getSupplierEmail(selectedOrder.supplierName);
    const subject = `Purchase Order ${selectedOrder.orderNumber} - ${selectedOrder.customer.name}`;
    
    // Official Zoho compose URL
    window.open('https://mail.zoho.eu/zm/#compose', '_blank');
    
    // Create alert with email details to copy
    setTimeout(() => {
      alert(`Zoho Mail opened. Please copy these details:\n\nTO: ${supplierEmail}\nSUBJECT: ${subject}\n\nThen attach the downloaded PDF and send.`);
    }, 1000);
  };

  const markOrderAsSent = async () => {
    const response = await fetch(`/api/orders/${selectedOrder.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_sent: true })
    });
    
    if (response.ok) {
      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? { ...order, emailSent: true } : order
      ));
      setSelectedOrder(prev => ({ ...prev, emailSent: true }));
    } else {
      alert(`API Error: ${response.status}`);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-slate-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading orders: {error}</p>
          <button 
            onClick={fetchOrders}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Bespoke Mattress Order Processor
              </h1>
              <p className="text-slate-600 mt-1">
                Review and process Shopify orders before sending to suppliers
              </p>
              {storageStatus && storageStatus.percentage > 80 && (
                <div className="mt-2 flex items-center gap-2 text-amber-600">
                  <AlertTriangle size={16} />
                  <span className="text-sm">
                    Storage {storageStatus.percentage}% full ({storageStatus.used}/{storageStatus.limit})
                  </span>
                </div>
              )}
            </div>
            <div className="text-sm text-slate-500">
              {orders.length} orders loaded
              <button 
                onClick={fetchOrders}
                className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow border">
              <div className="p-4 border-b bg-slate-50">
                <h2 className="text-lg font-semibold mb-3">Orders Queue</h2>
                <input
                  type="text"
                  placeholder="Search orders..."
                  className="w-full px-3 py-2 border rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {filteredOrders.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">
                    {searchTerm ? 'No orders match your search' : 'No orders found'}
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`p-4 border-b cursor-pointer hover:bg-slate-50 ${
                        selectedOrder?.id === order.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleOrderSelect(order)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{order.orderNumber}</span>
                            {order.diagramNumber && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                Shape {order.diagramNumber}
                              </span>
                            )}
                            {order.has_custom_diagram && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                Custom
                              </span>
                            )}
                            {order.notes && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                                Notes
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 text-sm">{order.customer.name}</div>
                          <div className="text-slate-500 text-xs">{order.orderDate}</div>
                          {order.supplierName && (
                            <div className="text-slate-500 text-xs mt-1">→ {order.supplierName}</div>
                          )}

                        </div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.emailSent 
                                ? 'bg-green-100 text-green-800'
                                : order.status === 'ready_to_send' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-grey-100 text-grey-800'
                            }`}>
                            {order.emailSent ? 'Sent' : (order.status === 'ready_to_send' ? 'Ready' : 'Review')}
                            </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedOrder ? (
              <div className="bg-white rounded-lg shadow border">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold">Order Details</h2>
                    <p className="text-sm text-slate-600">{selectedOrder.orderNumber}</p>
                  </div>
                  <div className="flex gap-2">
                    {!editMode ? (
                      <>
                        <button
                          onClick={handleEdit}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                        >
                          <Edit3 size={16} />
                          Edit
                        </button>
                        <button
                          onClick={generatePDF}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                        >
                          <Download size={16} />
                          Download PDF
                        </button>
                        <button
                        onClick={async () => {
                            try {
                                // 1. Download PDF locally
                                await generatePDF();
                                
                                // 2. Send test email automatically
                                const emailResponse = await fetch('/api/email/send', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        to: 'angelo@mybespokemattress.com',  // Your test email
                                        subject: `Purchase Order ${selectedOrder.orderNumber} - ${selectedOrder.customer.name}`,
                                        body: `
                                            <h2>New Purchase Order</h2>
                                            <p>Dear Supplier,</p>
                                            <p>Please find attached a new purchase order:</p>
                                            <ul>
                                                <li><strong>Order Number:</strong> ${selectedOrder.orderNumber}</li>
                                                <li><strong>Customer:</strong> ${selectedOrder.customer.name}</li>
                                            </ul>
                                            <p>Kind regards,<br>My Bespoke Order Ltd</p>
                                        `,
                                        orderId: selectedOrder.id,
                                        orderData: selectedOrder  // ADD THIS LINE
                                    })
                                });

                                if (!emailResponse.ok) throw new Error('Email sending failed');
                                
                                // 3. Mark as sent only if successful
                                await markOrderAsSent();
                                alert('PDF downloaded and email sent successfully!');
                                
                            } catch (error) {
                                console.error('Error:', error);
                                alert(`Failed: ${error.message}`);
                            }
                        }}
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center gap-2"
                        >
                          <Mail size={16} />
                          <Download size={14} />
                          Download and Email
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleSave}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                        >
                          <Save size={16} />
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 bg-slate-500 text-white rounded hover:bg-slate-600 flex items-center gap-2"
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Customer Notes</h3>
                    <textarea
                      value={selectedOrder.notes}
                      onChange={(e) => updateOrderField('notes', e.target.value)}
                      disabled={!editMode}
                      placeholder="No customer notes provided"
                      rows={3}
                      className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                    />
                  </div>
              
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Order Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Order Number</label>
                        <input
                          type="text"
                          value={selectedOrder.orderNumber}
                          onChange={(e) => updateOrderField('orderNumber', e.target.value)}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Order Date</label>
                        <input
                          type="date"
                          value={selectedOrder.orderDate}
                          onChange={(e) => updateOrderField('orderDate', e.target.value)}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Customer Name</label>
                        <input
                          type="text"
                          value={selectedOrder.customer.name}
                          onChange={(e) => updateCustomerField('name', e.target.value)}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={selectedOrder.customer.email}
                          onChange={(e) => updateCustomerField('email', e.target.value)}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Product Information</h3>
                    
                    {/* Supplier Code - Full width, multi-line - NOW FIRST */}
                    <div className="mb-4">
                      <label className="block text-sm text-slate-600 mb-1">Supplier Code</label>
                      <textarea
                        value={selectedOrder.supplierCode}
                        onChange={(e) => updateOrderField('supplierCode', e.target.value)}
                        disabled={!editMode}
                        rows={2}
                        className="w-full px-3 py-2 border rounded disabled:bg-slate-100 font-mono text-sm resize-none"
                      />
                    </div>
                    
                    {/* Firmness Override Section - NOW SECOND */}
                    <FirmnessOverrideSection 
                      selectedOrder={selectedOrder}
                      onSupplierCodeUpdate={(newCode) => {
                        setSelectedOrder(prev => ({ ...prev, supplierCode: newCode }));
                        setOrders(orders.map(order => 
                          order.id === selectedOrder.id 
                            ? { ...order, supplierCode: newCode } 
                            : order
                        ));
                      }}
                      editMode={editMode}
                    />
                    
                    {/* SKU and Quantity on same line below */}
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-600 mb-1">Product SKU</label>
                        <input
                          type="text"
                          value={selectedOrder.lineItems[0]?.sku || 'Unknown SKU'}
                          disabled
                          className="w-full px-3 py-2 border rounded bg-slate-100 text-sm"
                        />
                      </div>
                      
                      <div className="w-20">
                        <label className="block text-sm text-slate-600 mb-1">Qty</label>
                        <input
                          type="number"
                          value={selectedOrder.lineItems[0]?.quantity || 1}
                          onChange={(e) => {
                            const newQuantity = parseInt(e.target.value) || 1;
                            setSelectedOrder(prev => ({
                              ...prev,
                              lineItems: prev.lineItems.map((item, index) => 
                                index === 0 ? { ...item, quantity: newQuantity } : item
                              )
                            }));
                          }}
                          disabled={!editMode}
                          className="w-full px-2 py-2 border rounded disabled:bg-slate-100 text-center"
                          min="1"
                          max="99"
                        />
                      </div>
                    </div>
                    
                    {selectedOrder.supplierName && (
                      <div className="mt-3 text-sm text-slate-600">
                        Assigned to: <span className="font-medium">{selectedOrder.supplierName}</span>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Measurements & Shape Diagram</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm text-slate-600 mb-3">Dimensions</h4>
                        <div className="space-y-2">
                          {['Dimension A', 'Dimension B', 'Dimension C', 'Dimension D', 'Dimension E', 'Dimension F', 'Dimension G'].map((dimension) => {
                            const value = selectedOrder.lineItems[0]?.properties[dimension] || '';
                            const hasValue = value && value !== '';
                            
                            return (
                              <div key={dimension} className="flex items-center gap-2">
                                <label className="w-6 text-sm font-medium text-center">
                                  {dimension.replace('Dimension ', '')}
                                </label>
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => updateMeasurement(dimension, e.target.value)}
                                  disabled={!editMode}
                                  placeholder="Not provided"
                                  className={`flex-1 px-3 py-2 border rounded disabled:bg-slate-100 font-mono ${
                                    hasValue ? 'text-slate-900' : 'text-slate-400'
                                  }`}
                                />
                                {hasValue && !editMode && (
                                  <span className="text-xs text-green-600">✓</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm text-slate-600 mb-3">Additional Specifications</h4>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Radius of Top Corner</label>
                              <input
                                type="text"
                                value={selectedOrder.radiusTopCorner || ''}
                                onChange={(e) => updateAdditionalField('radiusTopCorner', e.target.value)}
                                disabled={!editMode}
                                placeholder="Enter radius"
                                className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Radius of Bottom Corner</label>
                              <input
                                type="text"
                                value={selectedOrder.radiusBottomCorner || ''}
                                onChange={(e) => updateAdditionalField('radiusBottomCorner', e.target.value)}
                                disabled={!editMode}
                                placeholder="Enter radius"
                                className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Finished Size Must Not Exceed</label>
                              <input
                                type="text"
                                value={selectedOrder.finishedSizeMax || ''}
                                onChange={(e) => updateAdditionalField('finishedSizeMax', e.target.value)}
                                disabled={!editMode}
                                placeholder="Enter maximum size"
                                className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm text-slate-600 mb-3">
                          Shape Diagram
                          {selectedOrder.diagramNumber && (
                            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              Shape {selectedOrder.diagramNumber}
                            </span>
                          )}
                          {selectedOrder.has_custom_diagram && (
                            <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              Custom Diagram
                            </span>
                          )}
                        </h4>
                        
                        <div className="border rounded bg-slate-50" style={{height: '400px'}}>
                          {selectedOrder.has_custom_diagram && selectedOrder.custom_diagram_url ? (
                            <div className="w-full h-full">
                              <img 
                                src={selectedOrder.custom_diagram_url} 
                                alt={`Custom diagram for order ${selectedOrder.orderNumber}`}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  console.error('Custom diagram failed to load:', selectedOrder.custom_diagram_url);
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="w-full h-full flex-col items-center justify-center text-slate-400 hidden">
                                <div className="text-sm mb-1">Custom diagram failed to load</div>
                                <div className="text-xs">{selectedOrder.custom_diagram_filename}</div>
                              </div>
                            </div>
                          ) : selectedOrder.shapeDiagramUrl ? (
                            <div className="w-full h-full">
                              <img 
                                src={selectedOrder.shapeDiagramUrl} 
                                alt={`Shape ${selectedOrder.diagramNumber} Measuring Diagram`}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  console.error('Diagram failed to load:', selectedOrder.shapeDiagramUrl);
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="w-full h-full flex-col items-center justify-center text-slate-400 hidden">
                                <div className="text-sm mb-1">Diagram failed to load</div>
                                <div className="text-xs">Shape #{selectedOrder.diagramNumber}</div>
                                <div className="text-xs mt-2 text-slate-300">
                                  Check: /images/diagrams/Shape_{selectedOrder.diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                              <div className="text-sm mb-1">
                                {selectedOrder.diagramNumber ? 'Diagram configured but not accessible' : 'No diagram specified'}
                              </div>
                              {selectedOrder.diagramNumber && (
                                <div className="text-xs">Shape #{selectedOrder.diagramNumber}</div>
                              )}
                              {!selectedOrder.diagramNumber && (
                                <div className="text-xs mt-2 text-slate-300">
                                  Diagram number not found in order properties
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Enhanced Upload Interface */}
                        {editMode && (
                          <div className="mt-4 border-t pt-4">
                            <h5 className="text-sm font-medium mb-2">Upload Custom Diagram</h5>
                            
                            {storageStatus && storageStatus.percentage > 80 && (
                              <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded text-sm flex items-center gap-2">
                                <AlertTriangle size={16} />
                                Warning: Storage is {storageStatus.percentage}% full ({storageStatus.used}/{storageStatus.limit})
                              </div>
                            )}
                            
                            <input 
                              type="file" 
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={handleFileSelect}
                              className="mb-2 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            
                            {selectedFile && (
                              <div className="mb-2 p-2 bg-blue-50 rounded">
                                <p className="text-sm text-blue-800">
                                  Selected: {selectedFile.name} ({(selectedFile.size/1024/1024).toFixed(2)}MB)
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <button 
                                    onClick={handleDiagramUpload} 
                                    disabled={uploadingDiagram}
                                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Upload size={14} />
                                    {uploadingDiagram ? 'Uploading...' : 'Upload Diagram'}
                                  </button>
                                  <button 
                                    onClick={() => setSelectedFile(null)} 
                                    className="px-3 py-1 bg-slate-500 text-white rounded text-sm hover:bg-slate-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {selectedOrder.has_custom_diagram && (
                              <div className="mt-2 p-2 bg-green-50 rounded">
                                <p className="text-sm text-green-800 mb-2">
                                  Custom diagram uploaded: {selectedOrder.custom_diagram_filename}
                                </p>
                                <button 
                                  onClick={handleDiagramRemove} 
                                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
                                >
                                  <Trash2 size={14} />
                                  Remove Custom Diagram
                                </button>
                              </div>
                            )}
                            
                            <div className="mt-2 text-xs text-slate-500">
                              Supported formats: JPG, PNG, PDF. Maximum size: 5MB.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Manufacturing Options</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Link Attachment</label>
                        <select
                          value={selectedOrder.linkAttachment}
                          onChange={(e) => updateOrderField('linkAttachment', e.target.value)}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                        >
                          <option value="One Piece Construction">One Piece Mattress No Link Required</option>
                          <option value="Leave Sections Loose">Leave Sections Loose</option>
                          <option value="Leave Bolster Loose">Leave Bolster Loose</option>
                          <option value="Fabric Link (+£40)">Fabric Link (+£40)</option>
                          <option value="Zip-Link (+£40)">Zip-Link (+£40)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Delivery Option</label>
                        <select
                          value={selectedOrder.deliveryOption}
                          onChange={(e) => updateOrderField('deliveryOption', e.target.value)}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                        >
                          <option value="Rolled and Boxed">Rolled and Boxed</option>
                          <option value="Full Size Ready to Use">Full Size Ready to Use</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Mattress Label</h3>
                    <select
                      value={selectedOrder.mattressLabel}
                      onChange={(e) => updateOrderField('mattressLabel', e.target.value)}
                      disabled={!editMode}
                      className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                    >
                      <option value="CaravanMattresses">Caravan Mattresses</option>
                      <option value="MotorhomeMattresses">Motorhome Mattresses</option>
                      <option value="MyBespokeMattresses">My Bespoke Mattresses</option>
                    </select>
                  </div>

                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow border p-8 text-center">
                <div className="text-slate-400">
                  <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Select an Order</h3>
                  <p className="text-slate-500">Choose an order from the list to view and edit its details.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderProcessor;