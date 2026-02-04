// routes/vendor/browse.js - Vendor browsing routes (view other vendors)
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireVendor } = require('../../middleware/auth');
  const { vendorNav, vendorHeader, isChatEnabled } = require('./shared');
  const { renderVendorListPage, renderVendorDetailPage, renderProductDetailPage } = require('../../helpers/vendorViews');

  // Vendors list
  router.get('/vendors', requireVendor, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);

    db.all(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)
            ORDER BY vb.business_name, u.name`, (err, vendors) => {
      if (err) vendors = [];
      const nav = vendorNav('vendors', chatEnabled);
      const header = vendorHeader(user);
      res.send(renderVendorListPage({ vendors, user, role: 'vendor', appConfig, nav, header, isAdmin: false }));
    });
  });

  // View vendor detail
  router.get('/vendors/:id', requireVendor, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;
    const chatEnabled = isChatEnabled(appConfig, user);

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) {
        res.redirect('/vendor/vendors');
        return;
      }

      db.all('SELECT * FROM vendor_products WHERE user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL) ORDER BY display_order, product_id', [vendorUserId], (err2, products) => {
        if (!products) products = [];
        const nav = vendorNav('vendors', chatEnabled);
        const header = vendorHeader(user);
        res.send(renderVendorDetailPage({ business, products, user, role: 'vendor', appConfig, nav, header, isAdmin: false }));
      });
    });
  });

  // View single product detail
  router.get('/vendors/:vendorId/product/:productId', requireVendor, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;
    const chatEnabled = isChatEnabled(appConfig, user);

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) return res.redirect('/vendor/vendors');

      db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL)', [productId, vendorUserId], (err2, product) => {
        if (err2 || !product) return res.redirect(`/vendor/vendors/${vendorUserId}`);
        const nav = vendorNav('vendors', chatEnabled);
        const header = vendorHeader(user);
        res.send(renderProductDetailPage({ product, business, user, role: 'vendor', appConfig, nav, header, isAdmin: false }));
      });
    });
  });

  return router;
};
