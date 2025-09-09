import React, { useState, useEffect } from 'react';
import { Download, Mail, Edit3, Save, X } from 'lucide-react';

const OrderProcessor = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getDiagramImageUrl = (diagramNumber) => {
    if (!diagramNumber) return null;
    return `/images/diagrams/Shape_${diagramNumber}_Caravan_Mattress_Measuring_Diagram.jpg`;
  };

  const transformApiOrder = (apiOrder) => {
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

    let store = 'UNKNOWN';
    if (apiOrder.mattress_label === 'Motorhome Mattresses') store = 'MOTO';
    else if (apiOrder.mattress_label === 'My Bespoke Mattresses') store = 'MYBE';
    else if (apiOrder.mattress_label === 'Caravan Mattresses') store = 'CARA';
    else if (apiOrder.mattress_label === 'MotorhomeMattresses') store = 'MOTO';
    else if (apiOrder.mattress_label === 'MyBespokeMattresses') store = 'MYBE';
    else if (apiOrder.mattress_label === 'CaravanMattresses') store = 'CARA';
    else if (apiOrder.order_number?.includes('MOTO')) store = 'MOTO';
    else if (apiOrder.order_number?.includes('MYBE')) store = 'MYBE'; 
    else if (apiOrder.order_number?.includes('CARA')) store = 'CARA';
    else if (apiOrder.order_number?.includes('BESP')) store = 'MYBE';

    const measurements = apiOrder.order_data?.order_data?.extracted_measurements?.[0]?.measurements || {};
    
    const properties = {};
    const dimensions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    
    dimensions.forEach(dim => {
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
    });

    return {
      id: apiOrder.id.toString(),
      store: store,
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
      supplierCode: orderData.supplierSpecification || '',
      shapeNumber: orderData.shapeNumber || '',
      diagramNumber: diagramNumber,
      shapeDiagramUrl: getDiagramImageUrl(diagramNumber),
      linkAttachment: linkAttachment,
      deliveryOption: deliveryOption,
      totalPrice: apiOrder.total_price,
      supplierName: apiOrder.supplier_name || orderData.supplierName,
      rawMeasurements: measurements,
      notes: apiOrder.notes || '',
      mattressLabel: apiOrder.mattress_label || 'CaravanMattresses'
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
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleOrderSelect = (order) => {
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
      setEditMode(false);
    } else {
      setSelectedOrder({ ...order });
      setEditMode(false);
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
          mattress_label: selectedOrder.mattressLabel
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? selectedOrder : order
      ));
      setEditMode(false);
      
    } catch (err) {
      console.error('Error saving order:', err);
      alert('Failed to save order changes');
    }
  };

  const handleCancel = () => {
    const originalOrder = orders.find(order => order.id === selectedOrder.id);
    setSelectedOrder({ ...originalOrder });
    setEditMode(false);
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

  const openZohoMail = () => {
    const subject = `Purchase Order ${selectedOrder.orderNumber}`;
    const zohoUrl = `https://mail.zoho.eu/zm/h/compose?subject=${encodeURIComponent(subject)}`;
    window.open(zohoUrl, '_blank');
    alert('Zoho Mail opened. Please attach PDF and send.');
  };

  const markOrderAsSent = async () => {
  try {
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
    }
  } catch (err) {
    console.error('Error marking order as sent:', err);
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
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              order.store === 'MOTO' ? 'bg-purple-100 text-purple-700' :
                              order.store === 'MYBE' ? 'bg-green-100 text-green-700' :
                              order.store === 'CARA' ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {order.store}
                            </span>
                            {order.diagramNumber && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                Shape {order.diagramNumber}
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
                          <div className="text-slate-500 text-xs mt-1">
                            {order.mattressLabel}
                          </div>
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
                            await generatePDF();
                            setTimeout(() => openZohoMail(), 500);
                            await markOrderAsSent();
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Supplier Code</label>
                        <input
                          type="text"
                          value={selectedOrder.supplierCode}
                          onChange={(e) => updateOrderField('supplierCode', e.target.value)}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border rounded disabled:bg-slate-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={selectedOrder.lineItems[0]?.quantity || 1}
                          onChange={(e) => updateOrderField('quantity', parseInt(e.target.value))}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                    {selectedOrder.supplierName && (
                      <div className="mt-2 text-sm text-slate-600">
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
                                disabled={!editMode}
                                placeholder="Enter radius"
                                className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Radius of Bottom Corner</label>
                              <input
                                type="text"
                                disabled={!editMode}
                                placeholder="Enter radius"
                                className="w-full px-3 py-2 border rounded disabled:bg-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">Finished Size Must Not Exceed</label>
                              <input
                                type="text"
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
                        </h4>
                        <div className="border rounded bg-slate-50" style={{height: '500px'}}>
                          {selectedOrder.shapeDiagramUrl ? (
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
                        
                        {editMode && (
                          <div className="flex gap-2 mt-2">
                            <button className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-sm">
                              Upload
                            </button>
                            <button className="flex-1 px-3 py-1 bg-slate-500 text-white rounded text-sm">
                              Generate
                            </button>
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