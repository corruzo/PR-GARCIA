Certificados de PRUEBA para `tests/bcvFuente.test.js` (solo 127.0.0.1, sin valor fuera de las pruebas):
`raiz.pem` firma un intermedio (`intermedio.der`) que firma `servidor.pem`. El servidor de prueba envía
solo su certificado, como hace www.bcv.org.ve, y el intermedio se descarga por AIA.
`intermedio-falso.der` tiene el mismo nombre pero no está firmado por la raíz: debe rechazarse.
