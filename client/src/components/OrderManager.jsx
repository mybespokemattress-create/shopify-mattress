import React, { useState, useEffect } from 'react';
import { Download, Mail, Edit3, Save, X } from 'lucide-react';

const OrderManager = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const sampleOrders = [
    {
      id: 'MOTO001234',
      store: 'MOTO',
      orderNumber: 'MOTO001234',
      customer: {
        name: 'John Smith',
        email: 'john.smith@email.com'
      },
      orderDate: '2025-09-03',
      status: 'pending_review',
      lineItems: [{
        sku: 'MAT-FIRM-001',
        quantity: 1,
        properties: {
          'Dimension A': '1800mm',
          'Dimension B': '1200mm',
          'Dimension C': '150mm',
          'Dimension D': '200mm',
          'Dimension E': '300mm',
          'Dimension F': '100mm',
          'Dimension G': '50mm'
        }
      }],
      supplierCode: 'FIRM-CV-001',
      shapeNumber: '7',
      shapeDiagramUrl: null,
      linkAttachment: 'Standard Links',
      deliveryOption: 'Standard Delivery (7-10 days)'
    },
    {
      id: 'MYBE002345',
      store: 'MYBE', 
      orderNumber: 'MYBE002345',
      customer: {
        name: 'Sarah Wilson',
        email: 'sarah.wilson@email.com'
      },
      orderDate: '2025-09-02',
      status: 'ready_to_send',
      lineItems: [{
        sku: 'MAT-SOFT-002',
        quantity: 2,
        properties: {
          'Dimension A': '1900mm',
          'Dimension B': '1400mm', 
          'Dimension C': '160mm',
          'Dimension D': '220mm',
          'Dimension E': '320mm',
          'Dimension F': '110mm',
          'Dimension G': '60mm'
        }
      }],
      supplierCode: 'SOFT-CV-002',
      shapeNumber: '12',
      shapeDiagramUrl: 'https://via.placeholder.com/600x400/f8fafc/475569?text=Shape+12+Diagram',
      linkAttachment: 'Heavy Duty Links', 
      deliveryOption: 'Express Delivery (3-5 days)'
    }
  ];

  useEffect(() => {
    setOrders(sampleOrders);
  }, []);

  const handleOrderSelect = (order) => {
    // If clicking the same order, toggle it closed
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
      setEditMode(false);
    } else {
      // Otherwise open the new order
      setSelectedOrder({ ...order });
      setEditMode(false);
    }
  };

  const handleEdit = () => setEditMode(true);
  const handleSave = () => {
    setOrders(orders.map(order => 
      order.id === selectedOrder.id ? selectedOrder : order
    ));
    setEditMode(false);
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

  const generatePDF = () => {
    console.log('Generating PDF for order:', selectedOrder.orderNumber);
    alert('PDF generated successfully!');
  };

  const openZohoMail = () => {
    const subject = `Purchase Order ${selectedOrder.orderNumber}`;
    const zohoUrl = `https://mail.zoho.eu/zm/h/compose?subject=${encodeURIComponent(subject)}`;
    window.open(zohoUrl, '_blank');
    alert('Zoho Mail opened. Please attach PDF and send.');
  };

  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Bespoke Mattress Order Manager
          </h1>
          <p className="text-slate-600 mt-1">
            Review and process Shopify orders before sending to suppliers
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Orders List */}
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
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`p-4 border-b cursor-pointer hover:bg-slate-50 ${
                      selectedOrder?.id === order.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleOrderSelect(order)}
                  >
                    <div className="font-semibold text-sm">{order.orderNumber}</div>
                    <div className="text-slate-600 text-sm">{order.customer.name}</div>
                    <div className="text-slate-500 text-xs">{order.orderDate}</div>
                    <div className="mt-1">
                      <span className={`px-2 py-1 rounded text-xs ${
                        order.status === 'ready_to_send' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status === 'ready_to_send' ? 'Ready' : 'Review'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="lg:col-span-2">
            {selectedOrder && (
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
                          onClick={() => {
                            generatePDF();
                            setTimeout(() => openZohoMail(), 500);
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
                  
                  {/* Order Information */}
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

                  {/* Customer Information */}
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

                  {/* Product Information */}
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
                  </div>

                  {/* Measurements and Shape Diagram */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Measurements & Shape Diagram</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      {/* LEFT: Measurements */}
                      <div>
                        <h4 className="text-sm text-slate-600 mb-3">Dimensions</h4>
                        <div className="space-y-2">
                          {['Dimension A', 'Dimension B', 'Dimension C', 'Dimension D', 'Dimension E', 'Dimension F', 'Dimension G'].map((dimension) => (
                            <div key={dimension} className="flex items-center gap-2">
                              <label className="w-6 text-sm font-medium text-center">
                                {dimension.replace('Dimension ', '')}
                              </label>
                              <input
                                type="text"
                                value={selectedOrder.lineItems[0]?.properties[dimension] || ''}
                                onChange={(e) => updateMeasurement(dimension, e.target.value)}
                                disabled={!editMode}
                                placeholder="0mm"
                                className="flex-1 px-3 py-2 border rounded disabled:bg-slate-100 font-mono"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Additional Specifications */}
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

                      {/* RIGHT: Shape Diagram */}
                      <div>
                        <h4 className="text-sm text-slate-600 mb-3">Shape Diagram</h4>
                        <div className="border rounded bg-slate-50" style={{height: '500px'}}>
                          {selectedOrder.shapeDiagramUrl ? (
                            <img 
                              src={selectedOrder.shapeDiagramUrl} 
                              alt="Shape Diagram"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                              <div className="text-sm mb-1">No diagram uploaded</div>
                              <div className="text-xs">Shape #{selectedOrder.shapeNumber}</div>
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

                  {/* Manufacturing Options */}
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
                          <option value="Standard Links">Standard Links</option>
                          <option value="Heavy Duty Links">Heavy Duty Links</option>
                          <option value="No Links Required">No Links Required</option>
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
                          <option value="Standard Delivery (7-10 days)">Standard Delivery (7-10 days)</option>
                          <option value="Express Delivery (3-5 days)">Express Delivery (3-5 days)</option>
                          <option value="Next Day Delivery">Next Day Delivery</option>
                          <option value="Collection">Collection</option>
                        </select>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderManager;