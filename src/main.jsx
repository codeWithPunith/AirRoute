import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import './index.css'

import App from './App.jsx'

// Bundlers rewrite leaflet's marker image URLs to something it cannot resolve.
// Point Icon.Default back at the real bundled assets.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon,
  shadowUrl: markerShadow,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)