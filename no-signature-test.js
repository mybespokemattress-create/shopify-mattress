# Test webhook endpoint without signature using PowerShell
try {
    $headers = @{
        'Content-Type' = 'application/json'
        'X-Shopify-Shop-Domain' = 'd587eb.myshopify.com'
        'X-Shopify-Topic' = 'orders/create'
    }
    
    $body = @{
        id = 999999
        email = 'test@caravan.com'
        note = 'Customer notes: Size A: 180cm, Size B: 75cm. Medium firmness.'
        name = '#CARA9999'
    } | ConvertTo-Json
    
    Write-Host "🧪 Testing webhook without signature..."
    
    $response = Invoke-WebRequest -Uri "https://shopify-mattress-production.up.railway.app/webhook/orders/create" -Method POST -Headers $headers -Body $body -TimeoutSec 10
    
    Write-Host "✅ SUCCESS: HTTP $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
    Write-Host "Issue is only signature verification!"
    
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "❌ Still getting 401 - signature required"
    }
}